"""Unified chat JSON router — OpenAI, Groq (QROK_*), Google Gemini, Cerebras.

Endpoints/models follow current provider docs (Aug 2026):
- Groq: https://console.groq.com/docs/overview (OpenAI-compat)
- Cerebras: https://inference-docs.cerebras.ai (OpenAI-compat)
- Google: generativelanguage.googleapis.com gemini-2.5-flash

Never logs prompt or completion bodies (HG-8). Heuristic callers must fall back
when this module raises or returns None.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Literal

import httpx

from config import settings

logger = logging.getLogger(__name__)

Purpose = Literal["extract", "docs", "classify", "match"]

# Prefer providers that typically have quota; cooldown skips 402/429 dead-ends.
PURPOSE_ORDER: dict[Purpose, tuple[str, ...]] = {
    "extract": ("openai", "qrok", "google", "cerebras"),
    "docs": ("openai", "google", "qrok"),
    "classify": ("openai", "qrok", "google", "cerebras"),
    "match": ("openai", "qrok", "google", "cerebras"),
}

# Production model IDs per current provider catalogs
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    # Groq production (QROK_API_KEY / GROQ_API_KEY) — https://console.groq.com/docs/models
    "qrok": "openai/gpt-oss-20b",
    # Google AI Studio / Gemini API — https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
    "google": "gemini-2.5-flash",
    # Cerebras production — https://inference-docs.cerebras.ai/models
    "cerebras": "gpt-oss-120b",
}

_OPENAI_COMPAT = {
    "openai": ("https://api.openai.com/v1/chat/completions", "openai"),
    # Groq OpenAI-compat base: https://api.groq.com/openai/v1
    "qrok": ("https://api.groq.com/openai/v1/chat/completions", "qrok"),
    # Cerebras OpenAI-compat base: https://api.cerebras.ai/v1
    "cerebras": ("https://api.cerebras.ai/v1/chat/completions", "cerebras"),
}

# provider -> unix time when cooldown ends
_COOLDOWN_UNTIL: dict[str, float] = {}
_COOLDOWN_BILLING_S = 3600.0  # 401/402/403 — billing or auth
_COOLDOWN_RATE_S = 120.0  # 429 — rate limit


class LlmError(Exception):
    """Provider call failed — callers should use heuristic fallback."""


def clear_provider_cooldowns() -> None:
    """Test helper — reset in-process cooldowns."""
    _COOLDOWN_UNTIL.clear()


def _qrok_key() -> str:
    """QROK_API_KEY is the project name; GROQ_API_KEY is the Groq console name."""
    return (settings.qrok_api_key or settings.groq_api_key or "").strip()


def has_chat_provider() -> bool:
    return bool(
        settings.openai_api_key
        or _qrok_key()
        or settings.google_api_key
        or settings.cerebras_api_key
    )


def provider_key_present(name: str) -> bool:
    return bool(
        {
            "openai": settings.openai_api_key,
            "qrok": _qrok_key(),
            "google": settings.google_api_key,
            "cerebras": settings.cerebras_api_key,
        }.get(name)
    )


def _provider_api_key(name: str) -> str:
    if name == "openai":
        return settings.openai_api_key
    if name == "qrok":
        return _qrok_key()
    if name == "cerebras":
        return settings.cerebras_api_key
    raise LlmError(f"unknown_provider:{name}")


def _provider_cooling_down(name: str) -> bool:
    until = _COOLDOWN_UNTIL.get(name)
    if until is None:
        return False
    if time.monotonic() >= until:
        _COOLDOWN_UNTIL.pop(name, None)
        return False
    return True


def _mark_provider_cooldown(name: str, status_code: int | None) -> None:
    if status_code is None:
        return
    if status_code in (401, 402, 403):
        secs = _COOLDOWN_BILLING_S
        reason = "billing_or_auth"
    elif status_code == 429:
        secs = _COOLDOWN_RATE_S
        reason = "rate_limit"
    else:
        return
    _COOLDOWN_UNTIL[name] = time.monotonic() + secs
    logger.warning(
        "llm_provider_cooldown provider=%s status=%s reason=%s secs=%s",
        name,
        status_code,
        reason,
        int(secs),
    )


def _http_status(exc: BaseException) -> int | None:
    if isinstance(exc, httpx.HTTPStatusError):
        return int(exc.response.status_code)
    return None


def _log_usage(purpose: str, provider: str, model: str, usage: dict[str, Any]) -> None:
    logger.info(
        "llm_tokens purpose=%s provider=%s model=%s prompt=%s completion=%s",
        purpose,
        provider,
        model,
        usage.get("prompt_tokens") or usage.get("promptTokenCount"),
        usage.get("completion_tokens") or usage.get("candidatesTokenCount"),
    )


def _openai_compat_chat(
    *,
    provider: str,
    messages: list[dict[str, str]],
    timeout: float,
) -> tuple[str, dict[str, Any], str]:
    url, _ = _OPENAI_COMPAT[provider]
    key = _provider_api_key(provider)
    if not key:
        raise LlmError(f"{provider}_missing_key")
    model = DEFAULT_MODELS[provider]
    body: dict[str, Any] = {
        "model": model,
        "temperature": 0.1,
        "messages": messages,
    }
    # JSON object mode — supported on OpenAI / Groq / Cerebras chat completions
    body["response_format"] = {"type": "json_object"}
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            url,
            headers={"authorization": f"Bearer {key}", "content-type": "application/json"},
            json=body,
        )
        res.raise_for_status()
        data = res.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage") or {}
    return content, usage, model


def _google_chat(
    *,
    messages: list[dict[str, str]],
    timeout: float,
) -> tuple[str, dict[str, Any], str]:
    key = settings.google_api_key
    if not key:
        raise LlmError("google_missing_key")
    model = DEFAULT_MODELS["google"]
    system = " ".join(m["content"] for m in messages if m["role"] == "system")
    user = "\n".join(m["content"] for m in messages if m["role"] != "system")
    # Prefer header auth so the key is not echoed in httpx request URLs (HG-8).
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            url,
            headers={
                "content-type": "application/json",
                "x-goog-api-key": key,
            },
            json={
                "systemInstruction": {"parts": [{"text": system or "Return JSON only."}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json",
                    # gemini-2.5-flash is a thinking model; disable budget so JSON
                    # responses are not empty after thoughts tokens.
                    "thinkingConfig": {"thinkingBudget": 0},
                },
            },
        )
        res.raise_for_status()
        data = res.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise LlmError("google_empty_candidates")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    content = "".join(p.get("text") or "" for p in parts)
    if not content.strip():
        raise LlmError("google_empty_content")
    usage = data.get("usageMetadata") or {}
    return content, usage, model


def chat_json(
    *,
    purpose: Purpose,
    messages: list[dict[str, str]],
    timeout: float = 60.0,
) -> dict[str, Any]:
    """
    Try providers in PURPOSE_ORDER. Returns parsed JSON object.
    Raises LlmError if every configured provider fails or none are set.
    """
    last: Exception | None = None
    tried = 0
    for provider in PURPOSE_ORDER[purpose]:
        if not provider_key_present(provider):
            continue
        if _provider_cooling_down(provider):
            logger.info("llm_provider_skipped provider=%s reason=cooldown", provider)
            continue
        tried += 1
        try:
            if provider == "google":
                content, usage, model = _google_chat(messages=messages, timeout=timeout)
            else:
                content, usage, model = _openai_compat_chat(
                    provider=provider, messages=messages, timeout=timeout
                )
            _log_usage(purpose, provider, model, usage)
            parsed = json.loads(content)
            if not isinstance(parsed, dict):
                raise LlmError("json_not_object")
            parsed["_provider"] = provider
            parsed["_model"] = model
            return parsed
        except Exception as exc:  # noqa: BLE001
            last = exc
            status = _http_status(exc)
            _mark_provider_cooldown(provider, status)
            logger.warning(
                "llm_provider_failed purpose=%s provider=%s err=%s status=%s",
                purpose,
                provider,
                type(exc).__name__,
                status,
            )
    if tried == 0:
        # All keys missing or cooling down — treat as no usable provider for this call.
        if any(provider_key_present(p) for p in PURPOSE_ORDER[purpose]):
            raise LlmError(
                f"all_providers_failed:{type(last).__name__ if last else 'cooldown'}"
            ) from last
        raise LlmError("no_chat_provider")
    raise LlmError(f"all_providers_failed:{type(last).__name__ if last else 'unknown'}") from last

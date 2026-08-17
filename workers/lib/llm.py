"""Unified chat JSON router — OpenAI, xAI Grok (Qrok), Google Gemini, Cerebras.

Never logs prompt or completion bodies (HG-8). Heuristic callers must fall back
when this module raises or returns None.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal

import httpx

from config import settings

logger = logging.getLogger(__name__)

Purpose = Literal["extract", "docs", "classify", "match"]

PURPOSE_ORDER: dict[Purpose, tuple[str, ...]] = {
    "extract": ("openai", "qrok", "google", "cerebras"),
    "docs": ("openai", "google", "qrok"),
    "classify": ("cerebras", "google", "openai", "qrok"),
    "match": ("cerebras", "google", "openai", "qrok"),
}

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "qrok": "grok-3-mini",
    "google": "gemini-2.0-flash",
    "cerebras": "llama3.1-8b",
}

_OPENAI_COMPAT = {
    "openai": ("https://api.openai.com/v1/chat/completions", lambda: settings.openai_api_key),
    "qrok": ("https://api.x.ai/v1/chat/completions", lambda: settings.qrok_api_key),
    "cerebras": (
        "https://api.cerebras.ai/v1/chat/completions",
        lambda: settings.cerebras_api_key,
    ),
}


class LlmError(Exception):
    """Provider call failed — callers should use heuristic fallback."""


def has_chat_provider() -> bool:
    return bool(
        settings.openai_api_key
        or settings.qrok_api_key
        or settings.google_api_key
        or settings.cerebras_api_key
    )


def provider_key_present(name: str) -> bool:
    return bool(
        {
            "openai": settings.openai_api_key,
            "qrok": settings.qrok_api_key,
            "google": settings.google_api_key,
            "cerebras": settings.cerebras_api_key,
        }.get(name)
    )


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
    url, key_fn = _OPENAI_COMPAT[provider]
    key = key_fn()
    if not key:
        raise LlmError(f"{provider}_missing_key")
    model = DEFAULT_MODELS[provider]
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            url,
            headers={"authorization": f"Bearer {key}", "content-type": "application/json"},
            json={
                "model": model,
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": messages,
            },
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
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            url,
            params={"key": key},
            json={
                "systemInstruction": {"parts": [{"text": system or "Return JSON only."}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json",
                },
            },
        )
        res.raise_for_status()
        data = res.json()
    parts = data["candidates"][0]["content"]["parts"]
    content = "".join(p.get("text") or "" for p in parts)
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
            logger.warning(
                "llm_provider_failed purpose=%s provider=%s err=%s",
                purpose,
                provider,
                type(exc).__name__,
            )
    if tried == 0:
        raise LlmError("no_chat_provider")
    raise LlmError(f"all_providers_failed:{type(last).__name__ if last else 'unknown'}") from last

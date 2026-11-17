"""Streaming chat for voice gateway — local keys only (HG-8: no message bodies)."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from typing import Any

import httpx

from config import settings
from voice_gateway.config import VOICE_LLM_MODEL, VOICE_LLM_PROVIDER
from voice_gateway.pipeline import PipelineError

logger = logging.getLogger(__name__)

_OPENAI_STREAM = {
    "openai": ("https://api.openai.com/v1/chat/completions", "openai"),
    "qrok": ("https://api.groq.com/openai/v1/chat/completions", "qrok"),
    "cerebras": ("https://api.cerebras.ai/v1/chat/completions", "cerebras"),
}

_DEFAULT_MODEL = {
    "openai": "gpt-4o-mini",
    "qrok": "llama-3.1-8b-instant",
    "cerebras": "gpt-oss-120b",
}

_PROVIDER_ORDER = ("openai", "qrok", "cerebras")

_cooldown_until: dict[str, float] = {}


def _qrok_key() -> str:
    return (settings.qrok_api_key or settings.groq_api_key or "").strip()


def _api_key(provider: str) -> str:
    if provider == "openai":
        return (settings.openai_api_key or "").strip()
    if provider == "qrok":
        return _qrok_key()
    if provider == "cerebras":
        return (settings.cerebras_api_key or "").strip()
    return ""


def _cooling(provider: str) -> bool:
    until = _cooldown_until.get(provider)
    if until is None:
        return False
    if time.monotonic() >= until:
        _cooldown_until.pop(provider, None)
        return False
    return True


def _mark_cooldown(provider: str, status: int | None) -> None:
    if status in (401, 402, 403, 429):
        _cooldown_until[provider] = time.monotonic() + (120 if status == 429 else 3600)


def _pick_providers() -> list[str]:
    if VOICE_LLM_PROVIDER and VOICE_LLM_PROVIDER != "auto":
        return [VOICE_LLM_PROVIDER]
    return [p for p in _PROVIDER_ORDER if _api_key(p) and not _cooling(p)]


def stream_chat_reply(history: list[dict[str, str]]) -> Iterator[str]:
    """Yield assistant text deltas; tries providers in order."""
    providers = _pick_providers()
    if not providers:
        raise PipelineError("llm_unavailable")
    last_err: Exception | None = None
    for provider in providers:
        try:
            yield from _stream_openai_compat(provider, history)
            logger.info("voice_llm provider=%s", provider)
            return
        except Exception as exc:
            last_err = exc
            status = None
            if isinstance(exc, httpx.HTTPStatusError):
                status = exc.response.status_code
            _mark_cooldown(provider, status)
            logger.warning("voice_llm_fail provider=%s err=%s", provider, type(exc).__name__)
    raise PipelineError("llm_unavailable") from last_err


def chat_reply(history: list[dict[str, str]]) -> str:
    return "".join(stream_chat_reply(history)).strip()[:400]


def _model_for(provider: str) -> str:
    if VOICE_LLM_MODEL:
        return VOICE_LLM_MODEL
    return _DEFAULT_MODEL[provider]


def _stream_openai_compat(
    provider: str,
    history: list[dict[str, str]],
) -> Iterator[str]:
    url, _ = _OPENAI_STREAM[provider]
    key = _api_key(provider)
    if not key:
        raise PipelineError("llm_unavailable")
    body: dict[str, Any] = {
        "model": _model_for(provider),
        "messages": history,
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 180,
    }
    with httpx.Client(timeout=120.0) as client:
        with client.stream(
            "POST",
            url,
            headers={"authorization": f"Bearer {key}", "content-type": "application/json"},
            json=body,
        ) as res:
            res.raise_for_status()
            for line in res.iter_lines():
                if not line:
                    continue
                raw = line.decode() if isinstance(line, bytes) else line
                if raw.startswith("data: "):
                    raw = raw[6:]
                if raw.strip() == "[DONE]":
                    break
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                delta = payload.get("choices", [{}])[0].get("delta", {}).get("content") or ""
                if delta:
                    yield delta
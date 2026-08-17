"""Phase 12.5 LLM router tests — no live keys."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from lib.llm import LlmError, chat_json, has_chat_provider


def test_has_chat_provider_false_without_keys():
    with patch("lib.llm.settings") as s:
        s.openai_api_key = ""
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = ""
        assert has_chat_provider() is False


def test_chat_json_openai_compat_parses_object():
    payload = {
        "choices": [{"message": {"content": '{"title":"Eng","company":"Acme"}'}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 4},
    }
    mock_res = MagicMock()
    mock_res.json.return_value = payload
    mock_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = "sk-test"
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = ""
        client_cls.return_value.__enter__.return_value.post.return_value = mock_res
        out = chat_json(
            purpose="extract",
            messages=[{"role": "user", "content": "x"}],
        )
    assert out["title"] == "Eng"
    assert out["_provider"] == "openai"
    assert out["_model"] == "gpt-4o-mini"


def test_chat_json_skips_missing_openai_uses_cerebras():
    payload = {
        "choices": [{"message": {"content": '{"category":"offer"}'}}],
        "usage": {},
    }
    mock_res = MagicMock()
    mock_res.json.return_value = payload
    mock_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = ""
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = "csk-test"
        post = client_cls.return_value.__enter__.return_value.post
        post.return_value = mock_res
        out = chat_json(
            purpose="classify",
            messages=[{"role": "user", "content": "x"}],
        )
    assert out["_provider"] == "cerebras"
    assert out["_model"] == "gpt-oss-120b"
    assert out["category"] == "offer"
    assert post.call_args.args[0] == "https://api.cerebras.ai/v1/chat/completions"
    assert post.call_args.kwargs["json"]["model"] == "gpt-oss-120b"


def test_chat_json_qrok_uses_groq_endpoint():
    payload = {
        "choices": [{"message": {"content": '{"ok":true}'}}],
        "usage": {},
    }
    mock_res = MagicMock()
    mock_res.json.return_value = payload
    mock_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = ""
        s.qrok_api_key = "gsk-test"
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = ""
        post = client_cls.return_value.__enter__.return_value.post
        post.return_value = mock_res
        out = chat_json(
            purpose="extract",
            messages=[{"role": "user", "content": "x"}],
        )
    assert out["_provider"] == "qrok"
    assert out["_model"] == "openai/gpt-oss-20b"
    assert post.call_args.args[0] == "https://api.groq.com/openai/v1/chat/completions"


def test_chat_json_google_uses_gemini_25_and_header_key():
    payload = {
        "candidates": [{"content": {"parts": [{"text": '{"score":1}'}]}}],
        "usageMetadata": {"promptTokenCount": 3, "candidatesTokenCount": 2},
    }
    mock_res = MagicMock()
    mock_res.json.return_value = payload
    mock_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = ""
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = "AIza-test"
        s.cerebras_api_key = ""
        post = client_cls.return_value.__enter__.return_value.post
        post.return_value = mock_res
        out = chat_json(
            purpose="docs",
            messages=[
                {"role": "system", "content": "json"},
                {"role": "user", "content": "x"},
            ],
        )
    assert out["_provider"] == "google"
    assert out["_model"] == "gemini-2.5-flash"
    assert "gemini-2.5-flash:generateContent" in post.call_args.args[0]
    assert post.call_args.kwargs["headers"]["x-goog-api-key"] == "AIza-test"
    assert "params" not in post.call_args.kwargs
    gen = post.call_args.kwargs["json"]["generationConfig"]
    assert gen["responseMimeType"] == "application/json"
    assert gen["thinkingConfig"]["thinkingBudget"] == 0


def test_chat_json_no_provider_raises():
    with patch("lib.llm.settings") as s:
        s.openai_api_key = ""
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = ""
        with pytest.raises(LlmError, match="no_chat_provider"):
            chat_json(purpose="extract", messages=[{"role": "user", "content": "x"}])


def test_chat_json_http_error_raises_after_retry():
    mock_res = MagicMock()
    mock_res.raise_for_status.side_effect = httpx.HTTPStatusError(
        "bad", request=MagicMock(), response=MagicMock(status_code=500)
    )

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = "sk-test"
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = ""
        client_cls.return_value.__enter__.return_value.post.return_value = mock_res
        with pytest.raises(LlmError, match="all_providers_failed"):
            chat_json(purpose="extract", messages=[{"role": "user", "content": "x"}])

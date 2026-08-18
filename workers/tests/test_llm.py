"""Phase 12.5 LLM router tests — no live keys."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from lib.llm import (
    LlmError,
    chat_json,
    clear_provider_cooldowns,
    has_chat_provider,
)


@pytest.fixture(autouse=True)
def _reset_cooldowns():
    clear_provider_cooldowns()
    yield
    clear_provider_cooldowns()


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


def test_match_prefers_openai_when_all_keys_present():
    openai_payload = {
        "choices": [{"message": {"content": '{"reasoning":"strong match"}'}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }
    openai_res = MagicMock()
    openai_res.json.return_value = openai_payload
    openai_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
    ):
        s.openai_api_key = "sk-test"
        s.qrok_api_key = "gsk-test"
        s.groq_api_key = ""
        s.google_api_key = "AIza-test"
        s.cerebras_api_key = "csk-test"
        post = client_cls.return_value.__enter__.return_value.post
        post.return_value = openai_res
        out = chat_json(purpose="match", messages=[{"role": "user", "content": "x"}])
    assert out["_provider"] == "openai"
    assert post.call_count == 1
    assert "openai.com" in post.call_args.args[0]


def test_match_skips_cerebras_after_402_cooldown():
    """Cerebras 402 must not be re-hit on the next job."""
    cerebras_res = MagicMock()
    cerebras_res.raise_for_status.side_effect = httpx.HTTPStatusError(
        "pay", request=MagicMock(), response=MagicMock(status_code=402)
    )
    openai_payload = {
        "choices": [{"message": {"content": '{"reasoning":"ok enough for match"}'}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }
    openai_res = MagicMock()
    openai_res.json.return_value = openai_payload
    openai_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
        patch(
            "lib.llm.PURPOSE_ORDER",
            {
                "match": ("cerebras", "openai"),
                "extract": ("openai",),
                "docs": ("openai",),
                "classify": ("openai",),
            },
        ),
    ):
        s.openai_api_key = "sk-test"
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = ""
        s.cerebras_api_key = "csk-test"
        post = client_cls.return_value.__enter__.return_value.post
        post.side_effect = [cerebras_res, openai_res]
        out1 = chat_json(purpose="match", messages=[{"role": "user", "content": "a"}])
        assert out1["_provider"] == "openai"

        post.side_effect = None
        post.reset_mock()
        post.return_value = openai_res
        out2 = chat_json(purpose="match", messages=[{"role": "user", "content": "b"}])
        assert out2["_provider"] == "openai"
        assert post.call_count == 1
        assert "openai.com" in post.call_args.args[0]


def test_match_skips_google_after_429_cooldown():
    google_res = MagicMock()
    google_res.raise_for_status.side_effect = httpx.HTTPStatusError(
        "rate", request=MagicMock(), response=MagicMock(status_code=429)
    )
    openai_payload = {
        "choices": [{"message": {"content": '{"reasoning":"fallback ok"}'}}],
        "usage": {},
    }
    openai_res = MagicMock()
    openai_res.json.return_value = openai_payload
    openai_res.raise_for_status = MagicMock()

    with (
        patch("lib.llm.settings") as s,
        patch("lib.llm.httpx.Client") as client_cls,
        patch(
            "lib.llm.PURPOSE_ORDER",
            {
                "match": ("google", "openai"),
                "extract": ("openai",),
                "docs": ("openai",),
                "classify": ("openai",),
            },
        ),
    ):
        s.openai_api_key = "sk-test"
        s.qrok_api_key = ""
        s.groq_api_key = ""
        s.google_api_key = "AIza-test"
        s.cerebras_api_key = ""
        post = client_cls.return_value.__enter__.return_value.post
        post.side_effect = [google_res, openai_res]
        out1 = chat_json(purpose="match", messages=[{"role": "user", "content": "a"}])
        assert out1["_provider"] == "openai"

        post.side_effect = None
        post.reset_mock()
        post.return_value = openai_res
        out2 = chat_json(purpose="match", messages=[{"role": "user", "content": "b"}])
        assert out2["_provider"] == "openai"
        assert post.call_count == 1
        assert "openai.com" in post.call_args.args[0]

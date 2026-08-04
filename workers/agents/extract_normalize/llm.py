"""Optional LLM refine — output is still gated by Pydantic (HG-9)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)


def llm_refine(raw_data: dict[str, Any], draft: dict[str, Any]) -> dict[str, Any]:
    """
    Ask the model to improve the draft JSON. Never trusts the response alone —
    caller must run validate_normalized before DB write.
    """
    if not settings.openai_api_key:
        return draft

    prompt = {
        "role": "user",
        "content": (
            "Improve this job extraction JSON. Keep salary in integer cents. "
            "Include field_confidence for title and company (0-1). "
            "Return ONLY JSON.\n"
            f"raw={json.dumps(raw_data)[:4000]}\n"
            f"draft={json.dumps(draft)[:2000]}"
        ),
    }
    # Token usage logged without PII body (HG-8)
    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"authorization": f"Bearer {settings.openai_api_key}"},
            json={
                "model": "gpt-4o-mini",
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": "You extract structured job postings. Never invent employers.",
                    },
                    prompt,
                ],
            },
        )
        res.raise_for_status()
        data = res.json()
    usage = data.get("usage") or {}
    logger.info(
        "extract_llm_tokens prompt=%s completion=%s",
        usage.get("prompt_tokens"),
        usage.get("completion_tokens"),
    )
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        return draft
    # Merge over draft so required keys survive partial LLM replies
    merged = {**draft, **parsed}
    if "field_confidence" in draft and isinstance(parsed.get("field_confidence"), dict):
        merged["field_confidence"] = {
            **draft["field_confidence"],
            **parsed["field_confidence"],
        }
    return merged

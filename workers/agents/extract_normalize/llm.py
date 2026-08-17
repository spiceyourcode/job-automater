"""Optional LLM refine — output is still gated by Pydantic (HG-9)."""

from __future__ import annotations

import json
import logging
from typing import Any

from agents.extract_normalize.schema import NormalizedJob
from lib.llm import LlmError, chat_json, has_chat_provider

logger = logging.getLogger(__name__)


def llm_refine(raw_data: dict[str, Any], draft: dict[str, Any]) -> dict[str, Any]:
    """
    Ask the model to improve the draft JSON. Never trusts the response alone —
    caller must run validate_normalized before DB write.
    """
    if not has_chat_provider():
        return draft

    try:
        parsed = chat_json(
            purpose="extract",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract structured job postings. Never invent employers. "
                        "Keep salary in integer cents. Return JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Improve this job extraction JSON. Include field_confidence "
                        "for title and company (0-1).\n"
                        f"raw={json.dumps(raw_data)[:4000]}\n"
                        f"draft={json.dumps(draft)[:2000]}"
                    ),
                },
            ],
        )
    except LlmError:
        logger.warning("extract_llm_unavailable")
        return draft

    parsed.pop("_provider", None)
    parsed.pop("_model", None)
    if not isinstance(parsed, dict):
        return draft
    allowed = set(NormalizedJob.model_fields)
    merged = {k: v for k, v in {**draft, **parsed}.items() if k in allowed}
    if "field_confidence" in draft and isinstance(parsed.get("field_confidence"), dict):
        merged["field_confidence"] = {
            **draft["field_confidence"],
            **parsed["field_confidence"],
        }
    return merged

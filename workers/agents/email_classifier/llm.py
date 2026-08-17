"""Optional LLM email classify — subject/snippet only (HG-8)."""

from __future__ import annotations

import logging

from agents.email_classifier.schema import Classification
from lib.llm import LlmError, chat_json, has_chat_provider

logger = logging.getLogger(__name__)

_CATEGORIES = (
    "application_confirmation",
    "interview_invitation",
    "rejection",
    "offer",
    "follow_up_request",
    "spam",
    "other",
)


def llm_classify_email(
    *,
    subject: str | None,
    snippet: str | None,
) -> Classification | None:
    if not has_chat_provider():
        return None
    try:
        parsed = chat_json(
            purpose="classify",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify a recruiter email. Categories: "
                        + ", ".join(_CATEGORIES)
                        + ". Return JSON {category, confidence (0-1), reason_codes: string[]}."
                    ),
                },
                {
                    "role": "user",
                    "content": f"subject={(subject or '')[:300]}\nsnippet={(snippet or '')[:500]}",
                },
            ],
        )
    except LlmError:
        logger.warning("email_llm_unavailable")
        return None
    cat = parsed.get("category")
    if cat not in _CATEGORIES:
        return None
    try:
        conf = float(parsed.get("confidence") or 0)
    except (TypeError, ValueError):
        return None
    codes = parsed.get("reason_codes") or ["llm"]
    if not isinstance(codes, list):
        codes = ["llm"]
    return Classification(
        category=cat,  # type: ignore[arg-type]
        confidence=max(0.0, min(1.0, conf)),
        reason_codes=[str(c)[:40] for c in codes[:5]],
    )

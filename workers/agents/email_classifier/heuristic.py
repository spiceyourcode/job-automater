"""Heuristic email classifier — subject/snippet only for scoring signals.

Never logs email bodies (HG-8).
"""

from __future__ import annotations

import logging
import re
from typing import Any

from agents.email_classifier.schema import CLASSIFIER_VERSION, Classification

logger = logging.getLogger(__name__)

_PATTERNS: list[tuple[str, list[str], float]] = [
    (
        "interview_invitation",
        [
            r"\binterview\b",
            r"\bschedule\b.*\b(call|interview|screen)\b",
            r"\bnext steps\b",
            r"\btechnical screen\b",
            r"\bphone screen\b",
            r"calendly\.com",
        ],
        0.92,
    ),
    (
        "offer",
        [
            r"\boffer (letter|of employment)\b",
            r"\bpleased to (offer|extend)\b",
            r"\bcompensation package\b",
            r"\bcongratulations\b.*\boffer\b",
        ],
        0.97,
    ),
    (
        "rejection",
        [
            r"\bunfortunately\b",
            r"\bnot (moving|proceeding) forward\b",
            r"\bother candidates\b",
            r"\bregret to inform\b",
            r"\bposition has been filled\b",
        ],
        0.93,
    ),
    (
        "application_confirmation",
        [
            r"\bapplication (received|submitted|confirmed)\b",
            r"\bthank you for (applying|your application)\b",
            r"\bwe (have )?received your application\b",
        ],
        0.94,
    ),
    (
        "follow_up_request",
        [
            r"\bfollow[- ]?up\b",
            r"\badditional (information|documents)\b",
            r"\bplease (reply|respond|provide)\b",
        ],
        0.84,
    ),
    (
        "spam",
        [
            r"\bunsubscribe\b",
            r"\bnewsletter\b",
            r"\bmarketing\b",
            r"\b% off\b",
        ],
        0.96,
    ),
]


def classify_email(
    *,
    subject: str | None,
    snippet: str | None,
    from_email: str | None = None,
) -> Classification:
    """
    Classify using subject + snippet only.
    Body may exist in DB but must not be passed into logs (HG-8).
    """
    text = f"{subject or ''} {snippet or ''}".lower()
    best: Classification = Classification(
        category="other",
        confidence=0.4,
        reason_codes=["fallback_other"],
    )

    for category, patterns, score in _PATTERNS:
        hits = [p for p in patterns if re.search(p, text, re.I)]
        if not hits:
            continue
        # More hits → slightly higher confidence (capped)
        conf = min(0.99, score + 0.01 * (len(hits) - 1))
        if conf > best.confidence:
            best = Classification(
                category=category,  # type: ignore[arg-type]
                confidence=round(conf, 2),
                reason_codes=[f"pat:{h[:40]}" for h in hits[:3]],
            )

    # Never log subject/snippet content at info — ids only
    logger.info(
        "email_classified category=%s confidence=%s version=%s",
        best.category,
        best.confidence,
        CLASSIFIER_VERSION,
    )
    _ = from_email  # reserved for sender-domain signals later
    return best


def match_application(
    *,
    subject: str | None,
    from_email: str | None,
    applications: list[dict[str, Any]],
) -> str | None:
    """Fuzzy-link email to an application by company name in subject/from."""
    hay = f"{subject or ''} {from_email or ''}".lower()
    for app in applications:
        company = str(app.get("company") or app.get("job_company") or "").lower()
        if company and len(company) >= 3 and company in hay:
            return str(app["id"])
        title = str(app.get("title") or app.get("job_title") or "").lower()
        if title and len(title) >= 8 and title in hay:
            return str(app["id"])
    return None

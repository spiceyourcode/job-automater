"""Email classification categories and AppFlow §2.5 confidence thresholds."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

EmailCategory = Literal[
    "application_confirmation",
    "interview_invitation",
    "rejection",
    "offer",
    "follow_up_request",
    "spam",
    "other",
]

# Auto-update only when confidence STRICTLY exceeds threshold (AppFlow §2.5).
AUTO_UPDATE_THRESHOLDS: dict[str, float] = {
    "application_confirmation": 0.9,
    "interview_invitation": 0.85,
    "rejection": 0.9,
    "offer": 0.95,
    "follow_up_request": 0.8,  # flag only — no status change
    "spam": 0.95,  # ignore
    "other": 1.01,  # never auto
}

# Category → application status when auto-applied
CATEGORY_STATUS: dict[str, str | None] = {
    "application_confirmation": "acknowledged",
    "interview_invitation": "interviewing",
    "rejection": "rejected",
    "offer": "offered",
    "follow_up_request": None,
    "spam": None,
    "other": None,
}

CLASSIFIER_VERSION = "heuristic-email-v1"


class Classification(BaseModel):
    category: EmailCategory
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason_codes: list[str] = Field(default_factory=list)
    extracted: dict[str, str] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}


def meets_auto_threshold(category: str, confidence: float) -> bool:
    """Contract FAILURE: never auto-update at or below threshold."""
    threshold = AUTO_UPDATE_THRESHOLDS.get(category, 1.01)
    return confidence > threshold

"""Fuzzy job deduplication — title + company + location (FR-DD-02)."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)

# Levenshtein-ish ratio distance threshold (< 0.3 distance ≈ > 0.7 similarity)
FUZZY_DISTANCE_MAX = 0.3

# Values that carry no discriminating signal — treated as "company unknown".
_PLACEHOLDER_COMPANIES = frozenset(
    {"unknown", "n a", "na", "none", "not specified", "not available", "tbd"}
)


def normalize_key_part(value: str | None) -> str:
    if not value:
        return ""
    text = _PUNCT.sub(" ", value.lower())
    return _WS.sub(" ", text).strip()


def _meaningful_part(value: str | None) -> str:
    """Normalized value, or empty when it carries no discriminating signal."""
    norm = normalize_key_part(value)
    if not norm or norm in _PLACEHOLDER_COMPANIES:
        return ""
    return norm


def dedup_key(title: str | None, company: str | None, location: str | None) -> str:
    return "|".join(
        [
            normalize_key_part(title),
            normalize_key_part(company),
            normalize_key_part(location),
        ]
    )


def fuzzy_distance(a: str, b: str) -> float:
    """0 = identical, 1 = totally different. Uses SequenceMatcher ratio."""
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    return 1.0 - SequenceMatcher(None, a, b).ratio()


def is_fuzzy_duplicate(
    left: dict[str, Any],
    right: dict[str, Any],
    *,
    max_distance: float = FUZZY_DISTANCE_MAX,
) -> bool:
    """True when title+company+location are near-matches.

    When either company is missing or a placeholder (e.g. ``"Unknown"``), it
    carries no discriminating signal, so the title must match exactly —
    otherwise unrelated roles at the same org (whose company is unknown)
    collapse into a single job.
    """
    title_a = _meaningful_part(left.get("title"))
    title_b = _meaningful_part(right.get("title"))
    if not title_a or not title_b:
        return False

    company_a = _meaningful_part(left.get("company"))
    company_b = _meaningful_part(right.get("company"))

    if title_a == title_b and company_a and company_b and company_a == company_b:
        return True

    if fuzzy_distance(title_a, title_b) > max_distance:
        return False

    # Title is a near-match. Without a meaningful company on both sides we
    # cannot tell roles apart, so demand an exact title.
    if not company_a or not company_b:
        return title_a == title_b

    if fuzzy_distance(company_a, company_b) > max_distance:
        return False

    loc_a = normalize_key_part(left.get("location"))
    loc_b = normalize_key_part(right.get("location"))
    if not loc_a or not loc_b:
        return True
    return fuzzy_distance(loc_a, loc_b) <= max_distance + 0.1


def find_duplicate_of(
    candidate: dict[str, Any],
    existing: list[dict[str, Any]],
) -> str | None:
    """Return id of first matching existing job, else None."""
    for row in existing:
        if str(row.get("id")) == str(candidate.get("id")):
            continue
        if row.get("is_duplicate"):
            continue
        if is_fuzzy_duplicate(candidate, row):
            return str(row["id"])
    return None

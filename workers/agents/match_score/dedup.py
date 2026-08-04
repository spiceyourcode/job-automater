"""Fuzzy job deduplication — title + company + location (FR-DD-02)."""

from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)

# Levenshtein-ish ratio distance threshold (< 0.3 distance ≈ > 0.7 similarity)
FUZZY_DISTANCE_MAX = 0.3


def normalize_key_part(value: str | None) -> str:
    if not value:
        return ""
    text = _PUNCT.sub(" ", value.lower())
    return _WS.sub(" ", text).strip()


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
    """True when title+company+location are near-matches."""
    ka = dedup_key(left.get("title"), left.get("company"), left.get("location"))
    kb = dedup_key(right.get("title"), right.get("company"), right.get("location"))
    if ka == kb and ka:
        return True
    # Component-wise: require title+company close; location optional soft
    t_dist = fuzzy_distance(
        normalize_key_part(left.get("title")),
        normalize_key_part(right.get("title")),
    )
    c_dist = fuzzy_distance(
        normalize_key_part(left.get("company")),
        normalize_key_part(right.get("company")),
    )
    if t_dist <= max_distance and c_dist <= max_distance:
        loc_a = normalize_key_part(left.get("location"))
        loc_b = normalize_key_part(right.get("location"))
        if not loc_a or not loc_b:
            return True
        return fuzzy_distance(loc_a, loc_b) <= max_distance + 0.1
    return False


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

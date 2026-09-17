"""Classify CV chunk text into standard resume sections (HG-9 — no invented content)."""

from __future__ import annotations

import re
from typing import Literal

CvSection = Literal[
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "body",
]

SECTION_ORDER: tuple[CvSection, ...] = (
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
)

# Heading keywords → section. Longer / more specific patterns first where needed.
_HEADING_MAP: list[tuple[re.Pattern[str], CvSection]] = [
    (re.compile(r"^(professional\s+)?summary|about(\s+me)?|objective|profile$", re.I), "summary"),
    (
        re.compile(
            r"^(work\s+)?experience|employment(\s+history)?|work\s+history|"
            r"professional\s+experience|career(\s+history)?$",
            re.I,
        ),
        "experience",
    ),
    (
        re.compile(r"^education|academic|qualifications?|degrees?$", re.I),
        "education",
    ),
    (
        re.compile(
            r"^skills|technical\s+skills|core\s+skills|competencies|"
            r"technologies|tech\s+stack$",
            re.I,
        ),
        "skills",
    ),
    (
        re.compile(r"^projects?|selected\s+projects|portfolio|case\s+studies$", re.I),
        "projects",
    ),
    (
        re.compile(
            r"^certifications?|certificates?|licen[cs]es?|credentials$",
            re.I,
        ),
        "certifications",
    ),
    (re.compile(r"^languages?$", re.I), "languages"),
]

_KNOWN_SECTION_TYPES = {
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "body",
}


def _first_line(text: str) -> str:
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip(" -•*\t#:").strip()
        if line:
            return line
    return ""


def classify_cv_section(
    text: str,
    *,
    stored_section_type: str | None = None,
) -> CvSection:
    """
    Infer section from chunk content (heading line) or a stored section_type.

    Prefer stored types when they are already one of the known sections
    (not generic \"body\"). Otherwise classify from the first non-empty line.
    """
    stored = (stored_section_type or "").strip().lower()
    if stored in _KNOWN_SECTION_TYPES and stored != "body":
        return stored  # type: ignore[return-value]

    heading = _first_line(text)
    # Short heading-only lines, or first line of a titled block
    candidates = [heading]
    # Also try if the whole chunk is a short heading
    stripped = text.strip()
    if stripped and stripped != heading:
        first_only = heading
        if len(first_only) <= 60 and "\n" in stripped:
            candidates = [first_only]

    for candidate in candidates:
        # Normalize "Education:" / "SKILLS -"
        norm = re.sub(r"[:\-–—|]+$", "", candidate).strip()
        if len(norm) > 80:
            continue
        for pattern, section in _HEADING_MAP:
            if pattern.match(norm):
                return section

    # Content heuristics when no heading matched
    lower = text.lower()
    if re.search(
        r"\b(bachelor|master|phd|b\.?s\.?|m\.?s\.?|university|college|gpa)\b",
        lower,
    ):
        return "education"
    if re.search(
        r"\b(certified|certification|aws certified|pmp|scrum master)\b",
        lower,
    ):
        return "certifications"
    if re.search(
        r"\b(native|fluent|conversational|bilingual)\b.*\b(english|spanish|french|german|swahili|arabic)\b"
        r"|\b(english|spanish|french|german|swahili|arabic)\b.*\b(native|fluent|conversational)\b",
        lower,
    ):
        return "languages"
    if re.search(
        r"\b(python|javascript|typescript|react|docker|kubernetes|sql|java|golang|aws)\b",
        lower,
    ) and len(text) < 400 and not re.search(r"\b(built|developed|led|managed)\b", lower):
        return "skills"

    return "body"


def resolve_chunk_section(chunk: dict) -> CvSection:
    """Classify a cv_chunks row dict."""
    content = str(chunk.get("content") or "")
    stored = str(chunk.get("section_type") or "") or None
    section = classify_cv_section(content, stored_section_type=stored)
    # Untyped body paragraphs without a heading become experience for CV layout
    if section == "body":
        return "experience"
    return section

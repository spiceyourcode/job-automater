"""Shared CV chunk text helpers for HG-9 grounded doc agents."""

from __future__ import annotations

import re
from typing import Any

_STORY_SECTION_PRIORITY = (
    "experience",
    "work",
    "projects",
    "body",
)
_SKIP_STORY_SECTIONS = frozenset(
    {"certifications", "education", "skills", "languages", "summary", "contact"}
)


_BULLET_LEAD = re.compile(r"^[\s●•\-\*]+")


def _normalize_clause(line: str) -> str:
    line = _BULLET_LEAD.sub("", line.strip())
    line = re.sub(r"\s+", " ", line)
    if line and not re.search(r"[.!?]$", line):
        line = line.rstrip(",;") + "."
    return line


def cv_bullet_clauses(text: str) -> list[str]:
    """One entry per CV bullet or sentence (stripped, period-terminated)."""
    raw_lines = re.split(r"[\n\r]+", text)
    clauses: list[str] = []
    for raw in raw_lines:
        raw = raw.strip()
        if not raw:
            continue
        if _BULLET_LEAD.match(raw) or raw.startswith("-"):
            clause = _normalize_clause(raw)
            if len(clause) >= 24:
                clauses.append(clause)
            continue
        for piece in re.split(r"(?<=[.!?])\s+", raw):
            clause = _normalize_clause(piece)
            if len(clause) >= 24:
                clauses.append(clause)
    return clauses


def cv_sentences(text: str) -> list[str]:
    clauses = cv_bullet_clauses(text)
    if clauses:
        return clauses
    return [text.strip()] if text.strip() else []


def chunk_action_verbs(text: str) -> bool:
    return bool(
        re.search(
            r"\b(built|designed|implemented|developed|engineered|led|created|"
            r"architected|automated|migrated|deployed|integrated|reduced|increased)\b",
            text,
            re.I,
        )
    )


def chunk_contact_noise_ratio(content: str) -> float:
    lines = [ln.strip() for ln in content.split("\n") if ln.strip()]
    if not lines:
        return 1.0
    noisy = 0
    for line in lines:
        if re.search(r"[\w.-]+@[\w.-]+\.\w+", line):
            noisy += 1
            continue
        if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+$", line):
            noisy += 1
            continue
        if re.search(r"fundamentals of .+ - ", line, re.I):
            noisy += 1
    return noisy / len(lines)


def clean_cv_header(text: str) -> str:
    lines = text.split("\n")
    cleaned: list[str] = []
    found_content = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if re.search(
            r"[@+]\d|linkedin|github|nakuru|kenya|summary|skills|backend|languages|"
            r"api|integration|databases|devops|quality",
            line,
            re.I,
        ):
            if not re.search(
                r"\b(built|designed|implemented|developed|engineered|optimized|reduced|"
                r"increased|achieved|delivered|managed|led|created|architected|automated|"
                r"refactored|migrated|deployed|configured|integrated|debugged|troubleshot|"
                r"solved|fixed|maintained|monitored|established|defined|documented)\b",
                line,
                re.I,
            ):
                continue
        if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+$", line):
            continue
        if re.search(r"[\w.-]+@[\w.-]+\.\w+", line):
            continue
        if re.search(r"--\s*\d+\s+of\s+\d+\s*--", line, re.I):
            continue
        if re.search(r"[\+\d\s]{10,}", line) and not re.search(r"\d{4}", line):
            continue
        if len(line) > 80 or found_content:
            found_content = True
            cleaned.append(line)
        elif len(line) > 50:
            found_content = True
            cleaned.append(line)
    return "\n".join(cleaned) if cleaned else text


def is_story_chunk(c: dict[str, Any]) -> bool:
    section = str(c.get("section_type") or "").lower()
    content = str(c.get("content") or "").strip()
    if not content or not c.get("id") or len(content) < 120:
        return False
    if section in _SKIP_STORY_SECTIONS:
        return False
    if chunk_contact_noise_ratio(content) > 0.45 and not chunk_action_verbs(content):
        return False
    if section in {"experience", "work", "projects"}:
        return True
    if section in {"body", ""}:
        return chunk_action_verbs(content)
    return False


def rank_story_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked: list[tuple[int, dict[str, Any]]] = []
    for c in chunks:
        if not is_story_chunk(c):
            continue
        section = str(c.get("section_type") or "body").lower()
        try:
            prio = _STORY_SECTION_PRIORITY.index(section)
        except ValueError:
            prio = len(_STORY_SECTION_PRIORITY)
        ranked.append((prio, c))
    ranked.sort(key=lambda x: x[0])
    return [c for _, c in ranked[:8]]

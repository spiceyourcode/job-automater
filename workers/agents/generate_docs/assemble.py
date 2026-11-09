"""Structured CV sections from cv_chunks — HG-9, auto-accepted traces (P9.5)."""

from __future__ import annotations

import re
from typing import Any

from agents.generate_docs.sections import resolve_chunk_section
from lib.cv_chunk_filters import (
    chunk_action_verbs,
    chunk_contact_noise_ratio,
    clean_cv_header,
    cv_bullet_clauses,
)

SECTION_CAPS: dict[str, int] = {
    "summary": 3,
    "experience": 8,
    "projects": 6,
    "certifications": 6,
    "skills": 15,
    "education": 4,
    "languages": 2,
}

_MAX_TRACES = 25

_CERT_RE = re.compile(
    r"fundamentals of|certification|certificate|cohort|course\s+\-|"
    r"great learning|cisco|microsoft|cybertalents",
    re.I,
)
_SKILL_HEADER_RE = re.compile(
    r"^(backend|frontend|languages|api\s*&|databases|devops|quality)\b",
    re.I,
)


def format_preferred_location(entry: Any) -> str:
    if isinstance(entry, str):
        return entry.strip()
    if isinstance(entry, dict):
        city = str(entry.get("city") or "").strip()
        country = str(entry.get("country") or entry.get("state") or "").strip()
        remote = entry.get("remote_ok") or entry.get("remoteOk")
        parts = [p for p in (city, country) if p]
        label = ", ".join(parts) if parts else ""
        if remote and label:
            return f"{label} (remote OK)"
        if label:
            return label
        if remote:
            return "Remote"
    return ""


def format_contact_lines(
    profile: dict[str, Any] | None,
    contact: dict[str, Any] | None,
) -> list[str]:
    lines: list[str] = []
    if contact:
        email = str(contact.get("email") or "").strip()
        if email and "@" in email:
            lines.append(email)
        phone = str(contact.get("phone") or "").strip()
        if phone and re.search(r"\d{9,}", phone):
            lines.append(phone)
    if profile:
        locs = profile.get("preferred_locations")
        if isinstance(locs, list):
            for item in locs[:2]:
                loc = format_preferred_location(item)
                if loc and loc not in lines:
                    lines.append(loc)
        elif locs:
            loc = format_preferred_location(locs)
            if loc:
                lines.append(loc)
        linkedin = str(profile.get("linkedin_url") or profile.get("linkedin") or "").strip()
        if linkedin.startswith("http"):
            lines.append(linkedin)
    return lines


def _job_blob(job: dict[str, Any]) -> str:
    return " ".join(
        str(job.get(k) or "")
        for k in ("title", "company", "description", "requirements", "responsibilities")
    ).lower()


def _score_clause(text: str, job_blob: str) -> float:
    tokens = [w for w in re.findall(r"[a-z0-9+#.-]{4,}", text.lower()) if len(w) > 3]
    if not tokens:
        return 0.0
    hits = sum(1 for w in tokens if w in job_blob)
    bonus = 0.5 if chunk_action_verbs(text) else 0.0
    return hits / len(tokens) + bonus


def _normalize_line(text: str) -> str:
    text = re.sub(r"^[\s●•\-\*]+", "", text.strip())
    text = re.sub(r"\s+", " ", text)
    return text


def _is_noise_line(text: str) -> bool:
    if len(text) < 12:
        return True
    if re.search(r"[\w.-]+@[\w.-]+\.\w+", text):
        return True
    if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+$", text):
        return True
    if re.search(r"^--\s*\d+\s+of\s+\d+", text):
        return True
    if _SKILL_HEADER_RE.match(text) and len(text) < 80:
        return True
    return False


def _is_cert_line(text: str) -> bool:
    return bool(_CERT_RE.search(text))


def _clause_section_hint(text: str, default: str) -> str:
    if _is_cert_line(text):
        return "certifications"
    if re.search(r"\b(university|college|bachelor|master|gpa|degree)\b", text, re.I):
        return "education"
    if re.search(
        r"\b(repo:|github\.com/|built|designed|implemented|developed|engineered)\b",
        text,
        re.I,
    ):
        if re.search(r"\b(project|platform|api)\b", text, re.I) or "repo:" in text.lower():
            return "projects"
        return "experience"
    return default


def _collect_clauses(
    chunk: dict[str, Any],
    job_blob: str,
) -> list[tuple[str, str, str, float]]:
    """Return (text, chunk_id, section, score) candidates."""
    cid = str(chunk["id"])
    content = clean_cv_header(str(chunk.get("content") or ""))
    if len(content) < 40:
        return []
    if chunk_contact_noise_ratio(content) > 0.55 and not chunk_action_verbs(content):
        if not _is_cert_line(content):
            return []

    base_section = resolve_chunk_section(chunk)
    if base_section == "body":
        if chunk_action_verbs(content):
            base_section = "experience"
        elif _is_cert_line(content):
            base_section = "certifications"
        else:
            return []

    out: list[tuple[str, str, str, float]] = []
    for raw in cv_bullet_clauses(content):
        line = _normalize_line(raw)
        if _is_noise_line(line):
            continue
        section = _clause_section_hint(line, base_section)
        if section == "experience" and _is_cert_line(line):
            section = "certifications"
        score = _score_clause(line, job_blob)
        out.append((line, cid, section, score))
    return out


def assemble_sections(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    accepted_traces: list[dict[str, Any]] | None = None,
    regenerate_sections: list[str] | None = None,
) -> tuple[dict[str, list[str]], list[dict[str, str]], list[str]]:
    """
    Build section bullets, traces (status=accepted), and cover-letter line picks.
    """
    job_blob = _job_blob(job)
    regen = {s.strip().lower() for s in (regenerate_sections or []) if s}
    sections: dict[str, list[str]] = {k: [] for k in SECTION_CAPS}
    traces: list[dict[str, str]] = []
    seen: set[str] = set()

    def want_section(section: str) -> bool:
        if not regen:
            return True
        return section.lower() in regen

    def can_add(section: str) -> bool:
        return len(sections.get(section, [])) < SECTION_CAPS.get(section, 8)

    def add_line(text: str, cid: str, section: str) -> bool:
        if not want_section(section):
            return False
        if not can_add(section):
            return False
        key = text.lower()
        if key in seen:
            return False
        seen.add(key)
        sections[section].append(text)
        if len(traces) < _MAX_TRACES:
            traces.append(
                {
                    "text": text,
                    "chunk_id": cid,
                    "section": section,
                    "status": "accepted",
                }
            )
        return True

    for raw in accepted_traces or []:
        text = _normalize_line(str(raw.get("text") or ""))
        cid = str(raw.get("chunk_id") or raw.get("chunkId") or "").strip()
        section = str(raw.get("section") or "experience").strip().lower()
        if section == "body":
            section = "experience"
        if len(text) < 8 or not cid:
            continue
        add_line(text, cid, section)

    candidates: list[tuple[str, str, str, float]] = []
    for ch in chunks:
        candidates.extend(_collect_clauses(ch, job_blob))

    candidates.sort(key=lambda x: -x[3])
    for text, cid, section, _score in candidates:
        add_line(text, cid, section)

    # Summary: reuse top experience/project lines (already traced under source section)
    if want_section("summary") and not sections["summary"]:
        for sec in ("experience", "projects"):
            for line in sections.get(sec) or []:
                if _is_cert_line(line) or not chunk_action_verbs(line):
                    continue
                sections["summary"].append(line)
                if len(sections["summary"]) >= SECTION_CAPS["summary"]:
                    break
            if sections["summary"]:
                break

    # Skills: extract short skill tokens from skills-tagged clauses if empty
    if want_section("skills") and not sections["skills"]:
        for ch in chunks:
            if resolve_chunk_section(ch) != "skills" and str(
                ch.get("section_type") or ""
            ).lower() != "skills":
                continue
            for token in re.findall(
                r"\b(python|typescript|javascript|node\.?js|nestjs|fastapi|django|"
                r"postgresql|mysql|docker|kubernetes|aws|azure|git|rest|graphql)\b",
                str(ch.get("content") or ""),
                re.I,
            ):
                t = token.lower()
                if t not in seen and can_add("skills"):
                    cid = str(ch["id"])
                    add_line(t, cid, "skills")

    filled = {k: v for k, v in sections.items() if v}
    cover_lines = pick_cover_letter_lines(filled, job)
    if len(cover_lines) < 2 and traces:
        t0 = traces[0]["text"]
        cover_lines = [t0, t0]
    return filled, traces, cover_lines


def pick_cover_letter_lines(
    sections: dict[str, list[str]],
    job: dict[str, Any],
) -> list[str]:
    job_blob = _job_blob(job)
    pool: list[tuple[float, str]] = []
    for sec in ("experience", "projects", "summary"):
        for line in sections.get(sec) or []:
            if _is_cert_line(line) or _is_noise_line(line):
                continue
            if not chunk_action_verbs(line) and sec != "summary":
                continue
            pool.append((_score_clause(line, job_blob), line))
    pool.sort(key=lambda x: -x[0])
    lines = [ln for _, ln in pool]
    if not lines:
        for sec in sections:
            for line in sections[sec]:
                if not _is_cert_line(line):
                    lines.append(line)
                    break
            if lines:
                break
    if len(lines) == 1:
        return [lines[0], lines[0]]
    if lines:
        return [lines[0], lines[1] if len(lines) > 1 else lines[0]]
    return []

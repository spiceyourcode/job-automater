"""Deterministic CV/CL generation grounded only in cv_chunks (HG-9)."""

from __future__ import annotations

import re
from typing import Any

from agents.generate_docs.sections import resolve_chunk_section
from agents.generate_docs.templates import render_cover_letter, render_cv

# Caps keep payloads bounded while remaining verbose vs the old 6-bullet limit.
_MAX_LINES_PER_CHUNK = 12
_MAX_TRACES = 80
_MAX_SKILLS = 40

# cv-generator banned fluff — strip from output when present as whole phrases
_BANNED_PHRASES = (
    "results-driven",
    "dynamic individual",
    "highly motivated",
    "team player",
    "proven track record",
    "passionate about",
    "passionate professional",
    "detail-oriented",
    "self-starter",
    "hard worker",
    "strong communication skills",
    "excellent communication",
    "synergy",
    "paradigm shift",
    "thought leader",
    "go-getter",
    "innovative thinker",
    "outside the box",
    "people person",
    "visionary",
    "change agent",
)


def _chunk_lines(content: str) -> list[str]:
    """Extract substantive lines; skip short heading-only labels when longer body follows."""
    lines: list[str] = []
    raw_lines = [r.strip(" -•*\t") for r in content.replace("\r", "").split("\n")]
    raw_lines = [ln for ln in raw_lines if ln]
    for i, line in enumerate(raw_lines):
        if len(line) < 8:
            continue
        # Skip lone section headings (short, no period) when more content exists
        if (
            i == 0
            and len(line) <= 40
            and not re.search(r"[.!?]", line)
            and len(raw_lines) > 1
            and re.match(
                r"^(professional\s+)?summary|about|objective|profile|"
                r"(work\s+)?experience|employment|education|skills|projects?|"
                r"certifications?|languages?$",
                line,
                re.I,
            )
        ):
            continue
        # Prefer sentence splits for dense paragraphs
        if len(line) > 220 and ". " in line:
            for part in re.split(r"(?<=[.!?])\s+", line):
                part = part.strip()
                if len(part) >= 12:
                    lines.append(part)
        elif len(line) >= 12:
            lines.append(line)
    return lines


def _ground_text(text: str) -> str:
    """Strip display prefix so HG-9 compares against chunk tokens."""
    if text.startswith("Relevant to ") and ": " in text:
        return text.split(": ", 1)[1]
    return text


def _scrub_banned(text: str) -> str:
    out = text
    for phrase in _BANNED_PHRASES:
        out = re.sub(re.escape(phrase), "", out, flags=re.I)
    return re.sub(r"\s{2,}", " ", out).strip(" ,;-")


def _contact_lines(
    profile: dict[str, Any] | None,
    contact: dict[str, Any] | None,
) -> list[str]:
    lines: list[str] = []
    if contact:
        email = str(contact.get("email") or "").strip()
        if email and "@" in email:
            lines.append(email)
    if profile:
        locs = profile.get("preferred_locations")
        if isinstance(locs, list) and locs:
            loc = str(locs[0] or "").strip()
            if loc:
                lines.append(loc)
        elif isinstance(locs, str) and locs.strip():
            lines.append(locs.strip())
    return lines


def _display_name(
    profile: dict[str, Any] | None,
    contact: dict[str, Any] | None,
) -> str:
    if contact:
        name = str(contact.get("name") or "").strip()
        if name:
            return name
    if profile:
        headline = str(profile.get("headline") or profile.get("current_role") or "").strip()
        if headline:
            return headline
    return "Candidate"


def generate_from_chunks(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
    contact: dict[str, Any] | None = None,
    cv_template: str = "modern",
    cl_template: str = "modern",
    accepted_traces: list[dict[str, Any]] | None = None,
    regenerate_sections: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build tailored CV + cover letter from cv_chunks only (HG-9).
    Uses all substantive chunk lines (capped), grouped into standard sections.
    Empty sections are omitted. Never invents employers/skills/metrics.
    """
    if not chunks:
        raise ValueError("no_cv_chunks")

    job_title = str(job.get("title") or "the role")
    company = str(job.get("company") or "the company")

    regen = {s.strip().lower() for s in (regenerate_sections or []) if s}

    sections: dict[str, list[str]] = {
        "summary": [],
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "certifications": [],
        "languages": [],
    }
    traces: list[dict[str, str]] = []
    accepted_chunk_ids: set[str] = set()
    seen_text: set[str] = set()

    def add_bullet(text: str, cid: str, section: str, status: str) -> bool:
        if len(traces) >= _MAX_TRACES:
            return False
        ground = _scrub_banned(_ground_text(text))
        if len(ground) < 8:
            return False
        key = ground.lower()
        if key in seen_text:
            return False
        sec = section if section in sections else "experience"
        if sec == "skills" and len(sections["skills"]) >= _MAX_SKILLS:
            return False
        seen_text.add(key)
        sections[sec].append(ground)
        traces.append(
            {
                "text": ground,
                "chunk_id": cid,
                "section": sec,
                "status": status,
            }
        )
        return True

    for raw in accepted_traces or []:
        text = str(raw.get("text") or "").strip()
        cid = str(raw.get("chunk_id") or raw.get("chunkId") or "").strip()
        section = str(raw.get("section") or "experience").strip().lower()
        if section == "body":
            section = "experience"
        if len(text) < 8 or not cid:
            continue  # HG-9: never keep untraced
        accepted_chunk_ids.add(cid)
        add_bullet(text, cid, section, "accepted")

    def want_section(section: str) -> bool:
        if not regen:
            return True
        return section.lower() in regen

    for ch in chunks:
        if len(traces) >= _MAX_TRACES:
            break
        cid = str(ch["id"])
        if cid in accepted_chunk_ids:
            continue
        section = resolve_chunk_section(ch)
        if not want_section(section):
            continue
        content = str(ch.get("content") or "")
        for line in _chunk_lines(content)[:_MAX_LINES_PER_CHUNK]:
            if not add_bullet(line, cid, section, "pending"):
                if len(traces) >= _MAX_TRACES:
                    break

    # Fallback: ensure at least some experience content
    if not any(sections.values()):
        for ch in chunks[:8]:
            cid = str(ch["id"])
            if cid in accepted_chunk_ids:
                continue
            section = resolve_chunk_section(ch)
            if not want_section(section):
                continue
            snippet = str(ch.get("content") or "").strip()[:400]
            if len(snippet) < 12:
                continue
            add_bullet(snippet[:400], cid, section, "pending")

    if not traces:
        raise ValueError("insufficient_cv_content")

    # Summary from summary section, else first 1–2 experience lines (copied, not invented)
    if not sections["summary"]:
        for t in traces:
            if t["section"] == "experience" and len(sections["summary"]) < 2:
                # Reuse text already in experience — also keep in experience
                # Only add to summary if we have room and it's grounded
                if t["text"] not in sections["summary"]:
                    sections["summary"].append(t["text"])
                    # Don't duplicate a new trace — summary reuses experience text
                    # which already has a trace; schema requires bullet in docs.

    # Drop empty section keys for render
    filled = {k: v for k, v in sections.items() if v}

    name_line = _display_name(profile, contact)
    contact_lines = _contact_lines(profile, contact)

    tailored_cv = render_cv(
        template=cv_template,
        name=name_line,
        job_title=job_title,
        company=company,
        sections=filled,
        contact_lines=contact_lines,
    )

    # Cover letter: prefer experience bullets (verbatim for HG-9)
    exp = filled.get("experience") or filled.get("summary") or list(traces[0]["text"] for _ in [0])
    lead = exp[0]
    support = exp[1] if len(exp) > 1 else exp[0]
    cover_letter = render_cover_letter(
        template=cl_template,
        name=name_line,
        job_title=job_title,
        company=company,
        lead=lead,
        support=support,
    )

    return {
        "tailored_cv": tailored_cv,
        "cover_letter": cover_letter,
        "bullet_traces": traces,
        "model_used": f"heuristic-docs-v2:{cv_template}",
    }

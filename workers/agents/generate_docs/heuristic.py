"""Deterministic CV/CL generation grounded only in cv_chunks (HG-9)."""

from __future__ import annotations

from typing import Any

from agents.generate_docs.assemble import assemble_sections, format_contact_lines
from agents.generate_docs.templates import render_cover_letter, render_cv


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
    Structured assembly with auto-accepted traces (P9.5).
    """
    if not chunks:
        raise ValueError("no_cv_chunks")

    job_title = str(job.get("title") or "the role")
    company = str(job.get("company") or "the company")

    filled, traces, cover_pick = assemble_sections(
        chunks=chunks,
        job=job,
        accepted_traces=accepted_traces,
        regenerate_sections=regenerate_sections,
    )

    if not traces:
        raise ValueError("insufficient_cv_content")

    name_line = _display_name(profile, contact)
    contact_lines = format_contact_lines(profile, contact)

    tailored_cv = render_cv(
        template=cv_template,
        name=name_line,
        job_title=job_title,
        company=company,
        sections=filled,
        contact_lines=contact_lines,
    )

    lead, support = cover_pick[0], cover_pick[1]
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
        "model_used": f"heuristic-docs-v3:{cv_template}",
    }

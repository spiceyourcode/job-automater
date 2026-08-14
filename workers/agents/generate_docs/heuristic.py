"""Deterministic CV/CL generation grounded only in cv_chunks (HG-9)."""

from __future__ import annotations

from typing import Any

from agents.generate_docs.templates import render_cover_letter, render_cv


def _chunk_lines(content: str) -> list[str]:
    lines = []
    for raw in content.replace("\r", "").split("\n"):
        line = raw.strip(" -•*\t")
        if len(line) >= 12:
            lines.append(line)
    return lines


def generate_from_chunks(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
    cv_template: str = "modern",
    cl_template: str = "modern",
) -> dict[str, Any]:
    """
    Build tailored CV + cover letter by selecting chunk lines.
    Templates only change layout — never invent employers or skills (HG-9).
    """
    if not chunks:
        raise ValueError("no_cv_chunks")

    job_title = str(job.get("title") or "the role")
    company = str(job.get("company") or "the company")
    headline = ""
    if profile:
        headline = str(profile.get("headline") or profile.get("current_role") or "")

    traces: list[dict[str, str]] = []
    experience_bullets: list[str] = []
    skills_bits: list[str] = []

    for ch in chunks:
        cid = str(ch["id"])
        section = str(ch.get("section_type") or "experience")
        content = str(ch.get("content") or "")
        for line in _chunk_lines(content)[:3]:
            if section == "skills":
                skills_bits.append(line)
                traces.append(
                    {"text": line, "chunk_id": cid, "section": "skills"}
                )
            else:
                bullet = f"Relevant to {job_title}: {line}"
                experience_bullets.append(bullet)
                traces.append(
                    {"text": line, "chunk_id": cid, "section": section}
                )
        if len(experience_bullets) >= 6:
            break

    if not experience_bullets:
        for ch in chunks[:4]:
            cid = str(ch["id"])
            snippet = str(ch.get("content") or "").strip()[:240]
            if len(snippet) < 12:
                continue
            experience_bullets.append(snippet)
            traces.append(
                {
                    "text": snippet[:200],
                    "chunk_id": cid,
                    "section": str(ch.get("section_type") or "experience"),
                }
            )

    if not experience_bullets:
        raise ValueError("insufficient_cv_content")

    name_line = headline or "Candidate"
    tailored_cv = render_cv(
        template=cv_template,
        name=name_line,
        job_title=job_title,
        company=company,
        experience_bullets=experience_bullets,
        skills=skills_bits[:8],
    )

    lead = experience_bullets[0]
    support = (
        experience_bullets[1]
        if len(experience_bullets) > 1
        else experience_bullets[0]
    )
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
        "model_used": f"heuristic-docs-v1:{cv_template}",
    }

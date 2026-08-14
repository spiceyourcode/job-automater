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


def _ground_text(text: str) -> str:
    """Strip display prefix so HG-9 compares against chunk tokens."""
    if text.startswith("Relevant to ") and ": " in text:
        return text.split(": ", 1)[1]
    return text


def generate_from_chunks(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
    cv_template: str = "modern",
    cl_template: str = "modern",
    accepted_traces: list[dict[str, Any]] | None = None,
    regenerate_sections: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build tailored CV + cover letter from cv_chunks only (HG-9).
    Templates change layout only. Optional section regenerate keeps accepted
    traces verbatim and rebuilds only listed sections.
    """
    if not chunks:
        raise ValueError("no_cv_chunks")

    job_title = str(job.get("title") or "the role")
    company = str(job.get("company") or "the company")
    headline = ""
    if profile:
        headline = str(profile.get("headline") or profile.get("current_role") or "")

    regen = {s.strip().lower() for s in (regenerate_sections or []) if s}

    experience_bullets: list[str] = []
    skills_bits: list[str] = []
    traces: list[dict[str, str]] = []
    accepted_chunk_ids: set[str] = set()

    for raw in accepted_traces or []:
        text = str(raw.get("text") or "").strip()
        cid = str(raw.get("chunk_id") or raw.get("chunkId") or "").strip()
        section = str(raw.get("section") or "experience").strip()
        if len(text) < 8 or not cid:
            continue  # HG-9: never keep untraced
        ground = _ground_text(text)
        accepted_chunk_ids.add(cid)
        if section.lower() == "skills":
            skills_bits.append(ground)
        else:
            bullet = (
                text
                if text.startswith("Relevant to ")
                else f"Relevant to {job_title}: {ground}"
            )
            experience_bullets.append(bullet)
        traces.append(
            {
                "text": ground,
                "chunk_id": cid,
                "section": section,
                "status": "accepted",
            }
        )

    def want_section(section: str) -> bool:
        if not regen:
            return True
        return section.lower() in regen

    for ch in chunks:
        cid = str(ch["id"])
        section = str(ch.get("section_type") or "experience")
        if not want_section(section):
            continue
        if cid in accepted_chunk_ids:
            continue
        content = str(ch.get("content") or "")
        for line in _chunk_lines(content)[:3]:
            if section == "skills":
                skills_bits.append(line)
                traces.append(
                    {
                        "text": line,
                        "chunk_id": cid,
                        "section": "skills",
                        "status": "pending",
                    }
                )
            else:
                experience_bullets.append(f"Relevant to {job_title}: {line}")
                traces.append(
                    {
                        "text": line,
                        "chunk_id": cid,
                        "section": section,
                        "status": "pending",
                    }
                )
        if (
            not regen
            and len([t for t in traces if t["section"] != "skills"]) >= 6
        ):
            break

    if not experience_bullets:
        for ch in chunks[:4]:
            if not want_section(str(ch.get("section_type") or "experience")):
                continue
            cid = str(ch["id"])
            if cid in accepted_chunk_ids:
                continue
            snippet = str(ch.get("content") or "").strip()[:240]
            if len(snippet) < 12:
                continue
            experience_bullets.append(snippet)
            traces.append(
                {
                    "text": snippet[:200],
                    "chunk_id": cid,
                    "section": str(ch.get("section_type") or "experience"),
                    "status": "pending",
                }
            )

    if not traces:
        raise ValueError("insufficient_cv_content")

    if not experience_bullets:
        experience_bullets = [
            t["text"] for t in traces if t["section"].lower() != "skills"
        ][:4] or [traces[0]["text"]]

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

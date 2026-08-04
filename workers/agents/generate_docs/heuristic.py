"""Deterministic CV/CL generation grounded only in cv_chunks (HG-9)."""

from __future__ import annotations

from typing import Any


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
) -> dict[str, Any]:
    """
    Build tailored CV + cover letter by selecting/rephrasing chunk lines.
    Never invents employers or skills not present in chunks.
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
            # Light rephrase: prefix for targeting — content still from chunk
            if section == "skills":
                skills_bits.append(line)
                traces.append(
                    {"text": line, "chunk_id": cid, "section": "skills"}
                )
            else:
                bullet = f"Relevant to {job_title}: {line}"
                # Keep grounding via original line tokens
                experience_bullets.append(bullet)
                traces.append(
                    {"text": line, "chunk_id": cid, "section": section}
                )
        if len(experience_bullets) >= 6:
            break

    if not experience_bullets:
        # Fallback: use raw chunk content snippets
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
    cv_parts = [
        f"# {name_line}",
        f"## Target: {job_title} at {company}",
        "",
        "## Experience highlights",
        *[f"- {b}" for b in experience_bullets],
    ]
    if skills_bits:
        cv_parts += ["", "## Skills", *[f"- {s}" for s in skills_bits[:8]]]

    # Cover letter uses first 2 grounded lines
    lead = experience_bullets[0]
    support = experience_bullets[1] if len(experience_bullets) > 1 else experience_bullets[0]
    # Extract original phrases for CL (already traced)
    cl = (
        f"Dear Hiring Team at {company},\n\n"
        f"I am writing to apply for the {job_title} role. "
        f"My background includes: {lead}\n\n"
        f"Additionally: {support}\n\n"
        f"I would welcome the chance to discuss how this experience aligns with your needs.\n\n"
        f"Sincerely,\n{name_line}"
    )

    return {
        "tailored_cv": "\n".join(cv_parts),
        "cover_letter": cl,
        "bullet_traces": traces,
        "model_used": "heuristic-docs-v1",
    }

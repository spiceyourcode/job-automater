"""CV + cover letter layout templates — layout only; never invent content (HG-9)."""

from __future__ import annotations

from typing import Literal

CvTemplate = Literal["modern", "classic", "minimal"]
ClTemplate = Literal["modern", "classic", "minimal", "standard"]

CV_TEMPLATES: tuple[str, ...] = ("modern", "classic", "minimal")
CL_TEMPLATES: tuple[str, ...] = ("modern", "classic", "minimal", "standard")


def normalize_cv_template(value: str | None) -> CvTemplate:
    v = (value or "modern").strip().lower()
    if v in CV_TEMPLATES:
        return v  # type: ignore[return-value]
    return "modern"


def normalize_cl_template(value: str | None) -> CvTemplate:
    v = (value or "modern").strip().lower()
    if v == "standard":
        return "modern"
    if v in ("modern", "classic", "minimal"):
        return v  # type: ignore[return-value]
    return "modern"


def render_cv(
    *,
    template: str,
    name: str,
    job_title: str,
    company: str,
    experience_bullets: list[str],
    skills: list[str],
) -> str:
    """
    Render CV markdown/text. Bullets and skills must be passed through verbatim
    so HG-9 traces remain substrings of the output.
    """
    t = normalize_cv_template(template)
    if t == "classic":
        return _cv_classic(name, job_title, company, experience_bullets, skills)
    if t == "minimal":
        return _cv_minimal(name, job_title, company, experience_bullets, skills)
    return _cv_modern(name, job_title, company, experience_bullets, skills)


def render_cover_letter(
    *,
    template: str,
    name: str,
    job_title: str,
    company: str,
    lead: str,
    support: str,
) -> str:
    """Render CL; lead/support must appear verbatim (HG-9)."""
    t = normalize_cl_template(template)
    if t == "classic":
        return _cl_classic(name, job_title, company, lead, support)
    if t == "minimal":
        return _cl_minimal(name, job_title, company, lead, support)
    return _cl_modern(name, job_title, company, lead, support)


def _cv_modern(
    name: str,
    job_title: str,
    company: str,
    experience_bullets: list[str],
    skills: list[str],
) -> str:
    parts = [
        f"# {name}",
        f"## Target: {job_title} at {company}",
        "",
        "## Experience highlights",
        *[f"- {b}" for b in experience_bullets],
    ]
    if skills:
        parts += ["", "## Skills", *[f"- {s}" for s in skills[:8]]]
    return "\n".join(parts)


def _cv_classic(
    name: str,
    job_title: str,
    company: str,
    experience_bullets: list[str],
    skills: list[str],
) -> str:
    lines = [
        name.upper(),
        "=" * max(len(name), 12),
        f"Position sought: {job_title} — {company}",
        "",
        "EXPERIENCE",
        "-" * 10,
    ]
    for i, b in enumerate(experience_bullets, start=1):
        lines.append(f"{i}. {b}")
    if skills:
        lines += ["", "SKILLS", "-" * 6, ", ".join(skills[:8])]
    return "\n".join(lines)


def _cv_minimal(
    name: str,
    job_title: str,
    company: str,
    experience_bullets: list[str],
    skills: list[str],
) -> str:
    lines = [
        name,
        f"{job_title} @ {company}",
        "",
        *[f"• {b}" for b in experience_bullets],
    ]
    if skills:
        lines += ["", "Skills: " + ", ".join(skills[:8])]
    return "\n".join(lines)


def _cl_modern(
    name: str, job_title: str, company: str, lead: str, support: str
) -> str:
    return (
        f"Dear Hiring Team at {company},\n\n"
        f"I am writing to apply for the {job_title} role. "
        f"My background includes: {lead}\n\n"
        f"Additionally: {support}\n\n"
        f"I would welcome the chance to discuss how this experience aligns with your needs.\n\n"
        f"Sincerely,\n{name}"
    )


def _cl_classic(
    name: str, job_title: str, company: str, lead: str, support: str
) -> str:
    return (
        f"To the Hiring Committee,\n"
        f"{company}\n\n"
        f"Re: Application for {job_title}\n\n"
        f"Please accept this letter as formal application for the {job_title} position. "
        f"Relevant experience: {lead}\n\n"
        f"Further detail: {support}\n\n"
        f"Thank you for your consideration.\n\n"
        f"Respectfully,\n{name}"
    )


def _cl_minimal(
    name: str, job_title: str, company: str, lead: str, support: str
) -> str:
    return (
        f"Hello {company} team,\n\n"
        f"Applying for {job_title}. {lead} {support}\n\n"
        f"— {name}"
    )

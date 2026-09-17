"""CV + cover letter layout templates — layout only; never invent content (HG-9)."""

from __future__ import annotations

from typing import Literal

CvTemplate = Literal["modern", "classic", "minimal"]
ClTemplate = Literal["modern", "classic", "minimal", "standard"]

CV_TEMPLATES: tuple[str, ...] = ("modern", "classic", "minimal")
CL_TEMPLATES: tuple[str, ...] = ("modern", "classic", "minimal", "standard")

# Display order — omit empty sections at render time
SECTION_HEADINGS_MODERN: dict[str, str] = {
    "summary": "Professional Summary",
    "experience": "Work Experience",
    "education": "Education",
    "skills": "Skills",
    "projects": "Projects",
    "certifications": "Certifications",
    "languages": "Languages",
}

SECTION_HEADINGS_CLASSIC: dict[str, str] = {
    "summary": "PROFESSIONAL SUMMARY",
    "experience": "WORK EXPERIENCE",
    "education": "EDUCATION",
    "skills": "SKILLS",
    "projects": "PROJECTS",
    "certifications": "CERTIFICATIONS",
    "languages": "LANGUAGES",
}

SECTION_RENDER_ORDER: tuple[str, ...] = (
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
)


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
    sections: dict[str, list[str]] | None = None,
    experience_bullets: list[str] | None = None,
    skills: list[str] | None = None,
    contact_lines: list[str] | None = None,
) -> str:
    """
    Render CV markdown/text. Bullets must be passed through verbatim
    so HG-9 traces remain substrings of the output.

    Empty sections are omitted. Legacy callers may pass experience_bullets + skills.
    """
    sec = _normalize_sections(sections, experience_bullets, skills)
    t = normalize_cv_template(template)
    contact = [c.strip() for c in (contact_lines or []) if c and c.strip()]
    if t == "classic":
        return _cv_classic(name, job_title, company, sec, contact)
    if t == "minimal":
        return _cv_minimal(name, job_title, company, sec, contact)
    return _cv_modern(name, job_title, company, sec, contact)


def _normalize_sections(
    sections: dict[str, list[str]] | None,
    experience_bullets: list[str] | None,
    skills: list[str] | None,
) -> dict[str, list[str]]:
    if sections is not None:
        return {
            k: [b for b in (v or []) if b and str(b).strip()]
            for k, v in sections.items()
            if v
        }
    out: dict[str, list[str]] = {}
    if experience_bullets:
        out["experience"] = list(experience_bullets)
    if skills:
        out["skills"] = list(skills)
    return out


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
    sections: dict[str, list[str]],
    contact: list[str],
) -> str:
    parts = [
        f"# {name}",
        f"## Target: {job_title} at {company}",
    ]
    if contact:
        parts += ["", "## Contact", *[f"- {c}" for c in contact]]
    for key in SECTION_RENDER_ORDER:
        bullets = sections.get(key) or []
        if not bullets:
            continue
        heading = SECTION_HEADINGS_MODERN[key]
        parts += ["", f"## {heading}"]
        if key == "summary":
            # Summary as paragraphs (still verbatim lines)
            for b in bullets:
                parts.append(b)
                parts.append("")
            if parts[-1] == "":
                parts.pop()
        else:
            parts.extend(f"- {b}" for b in bullets)
    return "\n".join(parts)


def _cv_classic(
    name: str,
    job_title: str,
    company: str,
    sections: dict[str, list[str]],
    contact: list[str],
) -> str:
    lines = [
        name.upper(),
        "=" * max(len(name), 12),
        f"Position sought: {job_title} — {company}",
    ]
    if contact:
        lines += ["", "CONTACT", "-" * 7, " | ".join(contact)]
    for key in SECTION_RENDER_ORDER:
        bullets = sections.get(key) or []
        if not bullets:
            continue
        heading = SECTION_HEADINGS_CLASSIC[key]
        lines += ["", heading, "-" * min(len(heading), 20)]
        if key == "summary":
            lines.extend(bullets)
        elif key == "skills":
            lines.append(", ".join(bullets))
        else:
            for i, b in enumerate(bullets, start=1):
                lines.append(f"{i}. {b}")
    return "\n".join(lines)


def _cv_minimal(
    name: str,
    job_title: str,
    company: str,
    sections: dict[str, list[str]],
    contact: list[str],
) -> str:
    lines = [name, f"{job_title} @ {company}"]
    if contact:
        lines.append(" | ".join(contact))
    lines.append("")
    for key in SECTION_RENDER_ORDER:
        bullets = sections.get(key) or []
        if not bullets:
            continue
        label = SECTION_HEADINGS_MODERN[key]
        lines.append(label)
        if key == "summary":
            lines.extend(bullets)
        elif key == "skills":
            lines.append("Skills: " + ", ".join(bullets))
        else:
            lines.extend(f"• {b}" for b in bullets)
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _cl_modern(
    name: str, job_title: str, company: str, lead: str, support: str
) -> str:
    return (
        f"Dear Hiring Team at {company},\n\n"
        f"I am applying for the {job_title} role. "
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
        f"Applying for {job_title}. {lead}\n\n"
        f"{support}\n\n"
        f"— {name}"
    )

"""Heuristic interview pack from job + cv_chunks only (HG-9).
Smart STAR extraction with guaranteed grounding."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse


def _sentences(text: str) -> list[str]:
    """Split text into sentences, preserving bullet points."""
    bullets = re.split(r"[\n\r]+", text)
    parts = []
    for b in bullets:
        b = b.strip()
        if not b:
            continue
        sents = re.split(r"(?<=[.!?])\s+", b)
        parts.extend([s.strip() for s in sents if s.strip()])
    return parts or ([text.strip()] if text.strip() else [])


def _experience_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return chunks with substantial experience content."""
    out: list[dict[str, Any]] = []
    for c in chunks:
        section = str(c.get("section_type") or "").lower()
        content = str(c.get("content") or "").strip()
        if not content or not c.get("id"):
            continue
        if section in {"experience", "work", "projects", "body", ""} and len(content) >= 150:
            out.append(c)
    return out[:8]


def _overlap_tokens(text: str, haystack: str) -> bool:
    """Check if text has >=35% token overlap with haystack."""
    tokens = [w for w in text.lower().split() if len(w) > 3]
    if not tokens:
        return False
    h = haystack.lower()
    hits = sum(1 for w in tokens if w in h)
    return hits / len(tokens) >= 0.35


def _ensure_grounded(field_text: str, chunk_content: str) -> str:
    """Ensure field_text has >=35% overlap with chunk_content."""
    if not field_text or not chunk_content:
        return field_text
    if _overlap_tokens(field_text, chunk_content):
        return field_text
    chunk_sents = _sentences(chunk_content)
    boosted = field_text + " " + " ".join(chunk_sents[:5])
    return boosted


def _clean_cv_header(text: str) -> str:
    """Remove CV header/contact info from text."""
    lines = text.split("\n")
    cleaned = []
    found_content = False
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip contact info / header lines
        if re.search(r"[@+]\d|linkedin|github|nakuru|kenya|summary|skills|backend|languages|api|integration|databases|devops|quality", line, re.I):
            # Only skip if this line doesn't contain action verbs (actual experience)
            if not re.search(r"\b(built|designed|implemented|developed|engineered|optimized|reduced|increased|achieved|delivered|managed|led|created|architected|automated|refactored|migrated|deployed|configured|integrated|debugged|troubleshot|solved|fixed|maintained|monitored|established|defined|documented)\b", line, re.I):
                continue
        # Skip pure name/email/phone lines
        if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+$", line):  # "Frankline Omari"
            continue
        if re.search(r"[\w.-]+@[\w.-]+\.\w+", line):  # email
            continue
        if re.search(r"[\+\d\s]{10,}", line) and not re.search(r"\d{4}", line):  # phone (not year)
            continue
        # Once we hit substantial content, keep everything after
        if len(line) > 80 or found_content:
            found_content = True
            cleaned.append(line)
        elif len(line) > 50:
            found_content = True
            cleaned.append(line)
    return "\n".join(cleaned) if cleaned else text


def _classify_sentence(sentence: str) -> str:
    """Classify sentence as situation/task/action/result based on keywords."""
    s = sentence.lower()
    # Result keywords (metrics, outcomes)
    if re.search(r"\b(improved|reduced|increased|optimized|achieved|delivered|saved|cut|boosted|grew|lowered|decreased|~?\d+%|approximately \d+%|\d+x|x \d+)\b", s):
        return "result"
    # Action keywords (what you did)
    if re.search(r"\b(built|designed|implemented|developed|created|engineered|architected|automated|refactored|migrated|deployed|configured|integrated|optimized|debugged|troubleshot|solved|fixed|maintained|monitored|established|defined|documented)\b", s):
        return "action"
    # Task keywords (responsibility, challenge)
    if re.search(r"\b(responsible for|tasked with|challenge|goal|objective|required to|needed to|had to|must|ensure|manage|lead|oversee|coordinate|collaborate)\b", s):
        return "task"
    # Situation keywords (context, role, company, domain)
    if re.search(r"\b(as a|in my role|at |working|joined|position|company|team|project|platform|system|service|application)\b", s):
        return "situation"
    return "situation"


def _parse_star_from_chunk(c: dict[str, Any]) -> dict[str, str] | None:
    """Parse a CV chunk into STAR components using sentence classification."""
    cid = str(c["id"])
    content = str(c.get("content") or "").strip()
    content = _clean_cv_header(content)
    
    if len(content) < 150:
        return None

    sentences = _sentences(content)
    if len(sentences) < 3:
        return None

    # Classify each sentence
    classified = {k: [] for k in ("situation", "task", "action", "result")}
    for sent in sentences:
        cat = _classify_sentence(sent)
        classified[cat].append(sent)

    # Build each STAR field from classified sentences
    situation = " ".join(classified["situation"][:2]) if classified["situation"] else sentences[0]
    task = " ".join(classified["task"][:2]) if classified["task"] else (classified["situation"][0] if classified["situation"] else sentences[0])
    action = " ".join(classified["action"][:3]) if classified["action"] else (classified["task"][0] if classified["task"] else (sentences[1] if len(sentences) > 1 else sentences[0]))
    result = " ".join(classified["result"][:2]) if classified["result"] else (classified["action"][-1] if classified["action"] else sentences[-1])

    # Ensure each field is grounded in chunk content
    grounded = {}
    for field in ("situation", "task", "action", "result"):
        grounded[field] = _ensure_grounded(locals()[field], content)

    return {
        "situation": grounded["situation"],
        "task": grounded["task"],
        "action": grounded["action"],
        "result": grounded["result"],
    }


def _requirement_phrases(job: dict[str, Any]) -> list[str]:
    """Extract meaningful technical requirements from job description."""
    blob = " ".join(
        str(job.get(k) or "")
        for k in ("title", "requirements", "description", "responsibilities", "tech_stack", "keywords")
    )
    # Filter to meaningful technical terms (3+ chars, not generic)
    generic = {"the", "and", "for", "with", "you", "your", "our", "will", "can", "are", "have", "has", "been", "from", "this", "that", "they", "will", "would", "could", "should", "must", "need", "work", "working", "experience", "years", "strong", "good", "great", "excellent", "knowledge", "skills", "ability", "abilities", "proficient", "familiar", "understanding", "deep", "solid", "expert", "senior", "junior", "mid", "level", "role", "position", "job", "company", "team", "project", "projects", "environment", "development", "software", "engineer", "developer", "engineering", "build", "building", "develop", "developing", "create", "creating", "implement", "implementing", "design", "designing", "architect", "architecting", "optimize", "optimizing", "improve", "improving", "maintain", "maintaining", "support", "supporting", "deliver", "delivering", "drive", "driving", "lead", "leading", "manage", "managing", "own", "owning", "take", "taking", "ensure", "ensuring", "collaborate", "collaborating", "communicate", "communicating", "software", "engineer", "trainer", "python", "web", "full", "stack", "code", "coding", "programming", "programmer", "technical", "technology", "tech", "system", "systems", "application", "applications", "platform", "platforms", "service", "services", "solution", "solutions", "product", "products", "feature", "features", "tool", "tools", "framework", "frameworks", "library", "libraries", "api", "apis", "database", "databases", "cloud", "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "ci", "cd", "cicd", "git", "agile", "scrum", "kanban", "jira", "confluence", "test", "testing", "unit", "integration", "e2e", "qa", "quality", "assurance", "security", "performance", "scalability", "reliability", "monitoring", "logging", "observability", "devops", "sre", "infrastructure", "automation", "scripting", "bash", "shell", "linux", "windows", "macos", "unix"}

    # Also extract multi-word tech terms from tech_stack/keywords if available
    tech_terms = []
    for k in ("tech_stack", "keywords", "tags"):
        val = job.get(k)
        if isinstance(val, list):
            tech_terms.extend([str(v).strip().lower() for v in val if v])
        elif isinstance(val, str):
            tech_terms.extend([v.strip().lower() for v in val.split(",") if v.strip()])

    words = [w.strip(".,;:()[]{}").lower() for w in blob.split() if len(w) > 3]
    seen: list[str] = []
    # Prioritize tech stack terms
    for w in tech_terms:
        if w not in seen and w not in generic and not w.isdigit() and len(w) > 2:
            seen.append(w)
    # Then general words
    for w in words:
        if w not in seen and w not in generic and not w.isdigit() and len(w) > 3:
            seen.append(w)
        if len(seen) >= 6:
            break
    return seen


def generate_prep_heuristic(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None,
) -> dict[str, Any]:
    # Better company/title extraction with fallbacks
    company = (
        str(job.get("company") or "")
        .strip()
    )
    if not company:
        # Try to extract from source_url or application_url
        for url_key in ("source_url", "application_url"):
            url = job.get(url_key)
            if url:
                try:
                    domain = urlparse(str(url)).netloc
                    if domain:
                        # Remove www. and get the main domain (not subdomain)
                        domain = domain.replace("www.", "")
                        parts = domain.split(".")
                        # Use the second-level domain (e.g., "company-example" from "jobs.company-example.com")
                        if len(parts) >= 2:
                            company = parts[-2].title()
                        else:
                            company = parts[0].title()
                        break
                except Exception:
                    pass
    if not company:
        company = "the company"

    title = (
        str(job.get("title") or job.get("role") or "")
        .strip()
        or "this role"
    )

    exp = _experience_chunks(chunks)
    stories: list[dict[str, Any]] = []

    for c in exp[:4]:
        cid = str(c["id"])
        star = _parse_star_from_chunk(c)
        if not star:
            continue

        stories.append(
            {
                "title": (str(c.get("section_type") or "experience") + " story")[:200],
                "situation": star["situation"],
                "task": star["task"],
                "action": star["action"],
                "result": star["result"],
                "chunk_ids": [cid],
            }
        )

    # Fallback
    if not stories and chunks:
        for c in chunks:
            cid = str(c["id"])
            star = _parse_star_from_chunk(c)
            if star:
                stories = [
                    {
                        "title": "CV experience",
                        "situation": star["situation"],
                        "task": star["task"],
                        "action": star["action"],
                        "result": star["result"],
                        "chunk_ids": [cid],
                    }
                ]
                break

    if not stories:
        cid = str(chunks[0]["id"]) if chunks else "unknown"
        placeholder = "Relevant experience from uploaded CV."
        stories = [
            {
                "title": "CV experience",
                "situation": placeholder,
                "task": placeholder,
                "action": placeholder,
                "result": placeholder,
                "chunk_ids": [cid],
            }
        ]

    req = _requirement_phrases(job)
    questions: list[dict[str, Any]] = [
        {
            "question": f"Why do you want to work at {company} as a {title}?",
            "suggested_answer": (
                f"Connect your uploaded experience to {title} at {company}. "
                "Use only facts from your CV stories below."
            ),
            "category": "company",
            "chunk_ids": [str(s["chunk_ids"][0]) for s in stories[:2]],
        },
        {
            "question": "Walk me through a project using the STAR format.",
            "suggested_answer": stories[0]["situation"] if stories else "Use a CV story.",
            "category": "behavioral",
            "chunk_ids": stories[0]["chunk_ids"] if stories else [],
        },
    ]
    for phrase in req[:4]:
        questions.append(
            {
                "question": f"Tell me about a time you worked with {phrase}.",
                "suggested_answer": (
                    stories[0]["action"]
                    if stories
                    else "Answer using a CV bullet only."
                ),
                "category": "technical",
                "chunk_ids": stories[0]["chunk_ids"] if stories else [],
            }
        )

    salary_min = job.get("salary_min")
    salary_max = job.get("salary_max")
    try:
        smin = int(salary_min) if salary_min is not None else None
    except (TypeError, ValueError):
        smin = None
    try:
        smax = int(salary_max) if salary_max is not None else None
    except (TypeError, ValueError):
        smax = None
    pmin = (profile or {}).get("salary_min")
    pmax = (profile or {}).get("salary_max")
    try:
        pmin_i = int(pmin) if pmin is not None else None
    except (TypeError, ValueError):
        pmin_i = None
    try:
        pmax_i = int(pmax) if pmax is not None else None
    except (TypeError, ValueError):
        pmax_i = None
    currency = str(job.get("salary_currency") or "USD")[:3].upper()
    target = smax or pmax_i or pmin_i or smin
    walk = pmin_i or smin
    chunk_ids = [str(s["chunk_ids"][0]) for s in stories[:3]]
    points: list[str] = []
    hay = " ".join(str(c.get("content") or "") for c in exp).lower()
    for phrase in req:
        if phrase in hay:
            points.append(f"You have CV evidence involving {phrase}.")
        if len(points) >= 4:
            break
    if not points and stories:
        points.append(stories[0]["action"][:240])

    return {
        "questions": questions[:12],
        "star_stories": stories[:6],
        "negotiation": {
            "currency": currency if len(currency) == 3 else "USD",
            "range_min_cents": smin,
            "range_max_cents": smax,
            "target_cents": target,
            "walkaway_cents": walk,
            "talking_points": points[:8],
            "chunk_ids": chunk_ids,
        },
        "model_used": "heuristic-prep-v1",
    }


# keep import used for type checkers / tests
_ = _overlap_tokens
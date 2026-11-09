"""Heuristic interview pack from job + cv_chunks only (HG-9).
Smart STAR extraction with guaranteed grounding."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from lib.cv_chunk_filters import (
    chunk_action_verbs,
    chunk_contact_noise_ratio,
    clean_cv_header,
    cv_sentences,
    rank_story_chunks,
)

_REQ_STOPWORDS = frozenset(
    {
        "tasks",
        "task",
        "hiring",
        "engineers",
        "backend",
        "frontend",
        "we're",
        "were",
        "coding",
        "engineer",
        "software",
        "developer",
        "designer",
        "senior",
        "junior",
        "remote",
        "hybrid",
        "full",
        "stack",
        "time",
        "role",
        "position",
        "looking",
        "join",
        "team",
        "work",
        "working",
        "about",
        "your",
        "our",
        "this",
        "that",
        "with",
        "from",
        "have",
        "will",
        "would",
        "could",
        "should",
        "must",
        "need",
        "using",
        "based",
        "years",
        "experience",
        "experienced",
        "codebase",
        "know",
        "well",
        "highly",
        "strong",
        "familiar",
        "comfortable",
        "understand",
        "understanding",
        "including",
        "ability",
        "preferred",
        "ideally",
        "someone",
        "looking",
        "opportunity",
        "actions",
        "deployment",
    }
)

_STAR_FIELD_CAP = 420
_TECH_HINT = re.compile(
    r"\b(python|javascript|typescript|java|golang|rust|ruby|php|sql|"
    r"postgresql|postgres|mysql|mongodb|redis|fastapi|django|flask|react|"
    r"nextjs|node|docker|kubernetes|aws|azure|gcp|graphql|rest|api|"
    r"github|gitlab|langchain|openai|tensorflow|pytorch)\b",
    re.I,
)


def _story_title(c: dict[str, Any]) -> str:
    content = str(c.get("content") or "").strip()
    for line in content.split("\n"):
        line = line.strip().lstrip("-•*")
        if len(line) < 12:
            continue
        if re.search(r"[\w.-]+@[\w.-]+\.\w+", line):
            continue
        if re.search(r"^[A-Z][a-z]+\s+[A-Z][a-z]+$", line):
            continue
        if chunk_contact_noise_ratio(line) >= 1.0:
            continue
        return line[:200]
    section = str(c.get("section_type") or "experience").replace("_", " ").strip()
    if section.lower() == "body":
        section = "experience"
    return f"{section.title()} highlight"


def _overlap_tokens(text: str, haystack: str) -> bool:
    """Check if text has >=35% token overlap with haystack."""
    tokens = [w for w in text.lower().split() if len(w) > 3]
    if not tokens:
        return False
    h = haystack.lower()
    hits = sum(1 for w in tokens if w in h)
    return hits / len(tokens) >= 0.35


def _trim_star_field(text: str) -> str:
    text = re.sub(r"\s*●\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= _STAR_FIELD_CAP:
        return text
    cut = text[:_STAR_FIELD_CAP]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(",;.") + "."


def _ensure_grounded(field_text: str, chunk_content: str) -> str:
    """Light overlap nudge — never append the whole chunk (HG-9)."""
    if not field_text or not chunk_content:
        return _trim_star_field(field_text)
    field_text = _trim_star_field(field_text)
    if _overlap_tokens(field_text, chunk_content):
        return field_text
    tokens = [w for w in field_text.lower().split() if len(w) > 3]
    if not tokens:
        return field_text
    extra: list[str] = []
    for sent in cv_sentences(chunk_content):
        low = sent.lower()
        if any(t in low for t in tokens[:6]):
            extra.append(sent)
        if len(extra) >= 1:
            break
    if extra:
        return _trim_star_field(f"{field_text} {extra[0]}")
    return field_text


def _classify_sentence(sentence: str) -> str:
    """Classify sentence as situation/task/action/result based on keywords."""
    s = sentence.lower()
    # Result keywords (metrics, outcomes)
    if re.search(
        r"\b(improved|reduced|increased|optimized|optimised|achieved|delivered|"
        r"saved|cut|boosted|grew|lowered|decreased|~?\d+%|approximately \d+%|\d+x|x \d+)\b",
        s,
    ):
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
    content = str(c.get("content") or "").strip()
    content = clean_cv_header(content)

    if len(content) < 120:
        return None
    if chunk_contact_noise_ratio(content) > 0.5 and not chunk_action_verbs(content):
        return None

    sentences = cv_sentences(content)
    if len(sentences) < 3:
        return None

    # Classify each sentence
    classified = {k: [] for k in ("situation", "task", "action", "result")}
    for sent in sentences:
        cat = _classify_sentence(sent)
        classified[cat].append(sent)

    # Build each STAR field — at most one clause each to avoid bullet dumps
    situation = sentences[0]
    for cand in sentences:
        if _classify_sentence(cand) == "situation" and not re.search(
            r"\d+\s*%|approximately\s+\d+",
            cand,
            re.I,
        ):
            situation = cand
            break
    task = (
        classified["task"][0]
        if classified["task"]
        else (sentences[1] if len(sentences) > 1 else sentences[0])
    )
    action = (
        classified["action"][0]
        if classified["action"]
        else (sentences[2] if len(sentences) > 2 else sentences[-1])
    )
    result = (
        classified["result"][-1]
        if classified["result"]
        else sentences[-1]
    )

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


def _valid_req_phrase(word: str, *, from_tech_list: bool = False) -> bool:
    w = word.strip(".,;:()[]{}").lower()
    if len(w) < 4 or len(w) > 40:
        return False
    if "'" in w or w in _REQ_STOPWORDS:
        return False
    if not re.fullmatch(r"[a-z0-9][a-z0-9.+#/-]*", w):
        return False
    if w.isdigit():
        return False
    if from_tech_list:
        return True
    if _TECH_HINT.fullmatch(w):
        return True
    return len(w) >= 6 and w not in _REQ_STOPWORDS


def _requirement_phrases(job: dict[str, Any]) -> list[str]:
    """Extract meaningful technical requirements from job description."""
    blob = " ".join(
        str(job.get(k) or "")
        for k in ("requirements", "description", "responsibilities", "tech_stack", "keywords")
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
    blob_l = blob.lower()
    for m in _TECH_HINT.finditer(blob_l):
        term = m.group(0).lower()
        if term not in seen:
            seen.append(term)
    for w in tech_terms:
        if w not in seen and w not in generic and _valid_req_phrase(w, from_tech_list=True):
            seen.append(w)
    for w in words:
        if w not in seen and w not in generic and _valid_req_phrase(w):
            seen.append(w)
        if len(seen) >= 6:
            break
    return seen


def _star_summary(story: dict[str, Any], *, max_len: int = 900) -> str:
    seen: set[str] = set()
    ordered: list[str] = []
    for key in ("situation", "task", "action", "result"):
        part = _trim_star_field(str(story.get(key) or ""))
        if not part or part in seen:
            continue
        seen.add(part)
        ordered.append(part)
    text = " ".join(ordered)
    return text[:max_len]


def _answer_for_company(*, company: str, title: str, story: dict[str, Any] | None) -> str:
    if not story:
        return (
            f"I want to contribute as {title} at {company}, using strengths shown in my CV."
        )
    snippet = _star_summary(story, max_len=500)
    return (
        f"I am interested in {title} at {company} because it fits work I have already done. "
        f"{snippet}"
    )[:4000]


def _answer_for_behavioral(story: dict[str, Any] | None) -> str:
    if not story:
        return "I would walk through a recent project using situation, task, action, and result."
    return _star_summary(story, max_len=1200)


def _answer_for_technical(*, phrase: str, stories: list[dict[str, Any]]) -> str:
    phrase_l = phrase.lower()
    for story in stories:
        blob = _star_summary(story).lower()
        if phrase_l in blob:
            return _star_summary(story, max_len=1000)
    if stories:
        action = _trim_star_field(str(stories[0].get("action") or ""))
        result = _trim_star_field(str(stories[0].get("result") or ""))
        return (
            f"On a recent project I applied skills relevant to {phrase}. "
            f"{action} {result}"
        ).strip()[:4000]
    return f"I would answer using a CV bullet that demonstrates {phrase}."


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

    exp = rank_story_chunks(chunks)
    stories: list[dict[str, Any]] = []

    for c in exp[:4]:
        cid = str(c["id"])
        star = _parse_star_from_chunk(c)
        if not star:
            continue

        stories.append(
            {
                "title": _story_title(c),
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
                        "title": _story_title(c),
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
    lead_story = stories[0] if stories else None
    questions: list[dict[str, Any]] = [
        {
            "question": f"Why do you want to work at {company} as a {title}?",
            "suggested_answer": _answer_for_company(
                company=company, title=title, story=lead_story
            ),
            "category": "company",
            "chunk_ids": [str(s["chunk_ids"][0]) for s in stories[:2]],
        },
        {
            "question": "Walk me through a project using the STAR format.",
            "suggested_answer": _answer_for_behavioral(lead_story),
            "category": "behavioral",
            "chunk_ids": stories[0]["chunk_ids"] if stories else [],
        },
    ]
    hay = " ".join(str(c.get("content") or "") for c in exp).lower()
    for phrase in req[:6]:
        if len(questions) >= 12:
            break
        if phrase not in hay and not _TECH_HINT.search(phrase):
            continue
        questions.append(
            {
                "question": f"Tell me about a time you used {phrase} in a project.",
                "suggested_answer": _answer_for_technical(phrase=phrase, stories=stories),
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

    pack = {
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
    return pack


# keep import used for type checkers / tests
_ = _overlap_tokens
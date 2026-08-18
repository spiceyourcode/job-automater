"""Heuristic interview pack from job + cv_chunks only (HG-9)."""

from __future__ import annotations

import re
from typing import Any


def _sentences(text: str) -> list[str]:
    parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def _experience_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for c in chunks:
        section = str(c.get("section_type") or "").lower()
        content = str(c.get("content") or "").strip()
        if not content or not c.get("id"):
            continue
        if section in {"experience", "work", "projects", "body", ""} or len(content) > 80:
            out.append(c)
    return out[:8] or [c for c in chunks if c.get("id") and c.get("content")][:8]


def _overlap_tokens(text: str, haystack: str) -> bool:
    tokens = [w for w in text.lower().split() if len(w) > 3]
    if not tokens:
        return False
    h = haystack.lower()
    hits = sum(1 for w in tokens if w in h)
    return hits / len(tokens) >= 0.35


def _requirement_phrases(job: dict[str, Any]) -> list[str]:
    blob = " ".join(
        str(job.get(k) or "")
        for k in ("title", "requirements", "description", "responsibilities")
    )
    words = [w.strip(".,;:()").lower() for w in blob.split() if len(w) > 4]
    seen: list[str] = []
    for w in words:
        if w not in seen:
            seen.append(w)
        if len(seen) >= 8:
            break
    return seen


def generate_prep_heuristic(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None,
) -> dict[str, Any]:
    company = str(job.get("company") or "the company")
    title = str(job.get("title") or "this role")
    exp = _experience_chunks(chunks)
    stories: list[dict[str, Any]] = []
    for c in exp[:4]:
        cid = str(c["id"])
        content = str(c.get("content") or "")
        sents = _sentences(content)
        situation = sents[0][:2000]
        task = (sents[1] if len(sents) > 1 else sents[0])[:2000]
        action = (sents[2] if len(sents) > 2 else sents[0])[:2000]
        result = (sents[-1] if sents else content[:400])[:2000]
        if len(situation) < 8:
            continue
        stories.append(
            {
                "title": (str(c.get("section_type") or "experience") + " story")[:200],
                "situation": situation if len(situation) >= 8 else content[:400],
                "task": task if len(task) >= 8 else situation,
                "action": action if len(action) >= 8 else situation,
                "result": result if len(result) >= 8 else situation,
                "chunk_ids": [cid],
            }
        )
    if not stories and exp:
        c = exp[0]
        text = str(c.get("content") or "Prior relevant work from the uploaded CV.")
        pad = text if len(text) >= 8 else f"{text} relevant experience."
        stories = [
            {
                "title": "CV experience",
                "situation": pad[:2000],
                "task": pad[:2000],
                "action": pad[:2000],
                "result": pad[:2000],
                "chunk_ids": [str(c["id"])],
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

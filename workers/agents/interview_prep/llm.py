"""Optional LLM interview pack — STAR still must pass HG-9 grounding."""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.llm import LlmError, chat_json, has_chat_provider

logger = logging.getLogger(__name__)


def llm_generate_prep(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not has_chat_provider() or not chunks:
        return None

    chunk_payload = [
        {
            "id": str(c.get("id")),
            "section": str(c.get("section_type") or "body"),
            "content": str(c.get("content") or "")[:800],
        }
        for c in chunks[:30]
        if c.get("id") and c.get("content")
    ]
    if not chunk_payload:
        return None

    try:
        parsed = chat_json(
            purpose="docs",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Create interview prep JSON using ONLY the CV chunks. "
                        "Never invent employers, titles, or results. "
                        "Every star_stories[].chunk_ids must be real chunk ids. "
                        "STAR text must reuse words from those chunks. "
                        "Salaries are integer cents. Return JSON keys: "
                        "questions [{question,suggested_answer,category,chunk_ids}], "
                        "star_stories [{title,situation,task,action,result,chunk_ids}], "
                        "negotiation {currency,range_min_cents,range_max_cents,"
                        "target_cents,walkaway_cents,talking_points,chunk_ids}."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "job_title": str(job.get("title") or ""),
                            "company": str(job.get("company") or ""),
                            "salary_min": job.get("salary_min"),
                            "salary_max": job.get("salary_max"),
                            "salary_currency": job.get("salary_currency") or "USD",
                            "profile_salary_min": (profile or {}).get("salary_min"),
                            "profile_salary_max": (profile or {}).get("salary_max"),
                            "chunks": chunk_payload,
                        }
                    )[:12000],
                },
            ],
        )
    except LlmError:
        logger.warning("interview_prep_llm_unavailable")
        return None

    provider = parsed.pop("_provider", "llm")
    model = parsed.pop("_model", "unknown")
    if not isinstance(parsed.get("questions"), list):
        return None
    if not isinstance(parsed.get("star_stories"), list):
        return None
    parsed["model_used"] = f"{provider}:{model}"
    return parsed

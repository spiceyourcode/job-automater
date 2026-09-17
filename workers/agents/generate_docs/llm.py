"""Optional LLM docs draft — HG-9 grounding is still required by the graph."""

from __future__ import annotations

import json
import logging
from typing import Any

from agents.generate_docs.sections import resolve_chunk_section
from lib.llm import LlmError, chat_json, has_chat_provider

logger = logging.getLogger(__name__)

_SYSTEM = """You write a tailored CV and cover letter using ONLY text from the provided CV chunks.

Hard rules (HG-9 — never invent):
- Never invent employers, job titles, dates, degrees, certifications, skills, metrics, or awards.
- Every bullet_traces[].text MUST be copied or lightly trimmed from its cited chunk (keep proper nouns, tools, dates).
- bullet_traces[].chunk_id must be a chunk id from the input.
- bullet_traces[].section must be one of: summary, experience, education, skills, projects, certifications, languages.
- Include standard headings only when you have chunk content for that section: Professional Summary, Work Experience, Education, Skills, Projects, Certifications, Languages. Omit empty sections.
- Prefer 3–6 experience bullets when chunks support them; use more if chunks provide more (do not invent).
- Cover letter: 3 short paragraphs that embed two verbatim traced lines (lead + support).
- Do NOT use banned fluff: results-driven, passionate about, team player, proven track record, detail-oriented, self-starter, synergy, thought leader, go-getter, outside the box.
- Single-column plain text / markdown; hyphen (-) bullets only.
- Return JSON only: tailored_cv, cover_letter, bullet_traces (array of {text, chunk_id, section}).
"""


def llm_generate_docs(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    cv_template: str,
    cl_template: str,
    contact: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if not has_chat_provider() or not chunks:
        return None

    chunk_payload = []
    for c in chunks[:60]:
        if not c.get("id") or not c.get("content"):
            continue
        chunk_payload.append(
            {
                "id": str(c.get("id")),
                "section": resolve_chunk_section(c),
                "content": str(c.get("content") or "")[:1600],
            }
        )
    if not chunk_payload:
        return None

    contact_safe: dict[str, str] = {}
    if contact:
        if contact.get("name"):
            contact_safe["name"] = str(contact["name"])[:200]
        if contact.get("email"):
            contact_safe["email"] = str(contact["email"])[:200]

    try:
        parsed = chat_json(
            purpose="docs",
            messages=[
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "job_title": str(job.get("title") or ""),
                            "company": str(job.get("company") or ""),
                            "cv_template": cv_template,
                            "cl_template": cl_template,
                            "headline": str(
                                (profile or {}).get("headline")
                                or (profile or {}).get("current_role")
                                or ""
                            ),
                            "contact": contact_safe,
                            "chunks": chunk_payload,
                        }
                    )[:24000],
                },
            ],
        )
    except LlmError:
        logger.warning("generate_docs_llm_unavailable")
        return None

    provider = parsed.pop("_provider", "llm")
    model = parsed.pop("_model", "unknown")
    traces = parsed.get("bullet_traces")
    if not isinstance(traces, list) or not traces:
        return None
    return {
        "tailored_cv": parsed.get("tailored_cv"),
        "cover_letter": parsed.get("cover_letter"),
        "bullet_traces": traces,
        "model_used": f"{provider}:{model}:{cv_template}",
    }

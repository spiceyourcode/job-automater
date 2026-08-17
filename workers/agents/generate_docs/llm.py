"""Optional LLM docs draft — HG-9 grounding is still required by the graph."""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.llm import LlmError, chat_json, has_chat_provider

logger = logging.getLogger(__name__)


def llm_generate_docs(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    cv_template: str,
    cl_template: str,
) -> dict[str, Any] | None:
    if not has_chat_provider() or not chunks:
        return None

    chunk_payload = [
        {
            "id": str(c.get("id")),
            "section": str(c.get("section_type") or "body"),
            "content": str(c.get("content") or "")[:1200],
        }
        for c in chunks[:40]
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
                        "Write a tailored CV and cover letter using ONLY phrases from "
                        "the provided CV chunks. Never invent employers, titles, dates, "
                        "or skills. Every bullet_traces[].text must be copied or lightly "
                        "trimmed from its chunk. Return JSON: tailored_cv, cover_letter, "
                        "bullet_traces (array of {text, chunk_id, section})."
                    ),
                },
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
                            "chunks": chunk_payload,
                        }
                    )[:12000],
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

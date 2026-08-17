"""LLM rewrite of match reasoning — numeric scores stay heuristic (HG-9)."""

from __future__ import annotations

import logging

from lib.llm import LlmError, chat_json

logger = logging.getLogger(__name__)


def rewrite_reasoning(
    *,
    reasoning: str,
    overall: float,
    matched_names: list[str],
    missing_names: list[str],
    job_title: str,
    company: str,
) -> str | None:
    try:
        parsed = chat_json(
            purpose="match",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Rewrite match reasoning in 2-4 sentences. Use only the "
                        "provided scores and skill names. Do not invent skills or employers. "
                        "Return JSON {\"reasoning\": \"...\"}."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"title={job_title[:120]} company={company[:80]} overall={overall:.0f} "
                        f"matched={', '.join(matched_names) or 'none'} "
                        f"gaps={', '.join(missing_names) or 'none'} "
                        f"base={reasoning[:500]}"
                    ),
                },
            ],
        )
    except LlmError:
        logger.warning("match_llm_unavailable")
        return None
    text = parsed.get("reasoning")
    if not isinstance(text, str) or len(text.strip()) < 20:
        return None
    return text.strip()[:2000]

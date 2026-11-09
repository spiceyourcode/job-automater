"""Interview prep agent — company Q&A, STAR stories, negotiation (HG-9)."""

from __future__ import annotations

from typing import Any


def run_interview_prep(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    from agents.interview_prep.graph import run_interview_prep as _run

    return _run(chunks=chunks, job=job, profile=profile)


__all__ = ["run_interview_prep"]

"""GenerateDocs agent — tailored CV + cover letter from cv_chunks only."""

from __future__ import annotations

from typing import Any

from agents.generate_docs.schema import GeneratedDocuments, validate_generated


def run_generate_docs(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
    contact: dict[str, Any] | None = None,
    cv_template: str = "modern",
    cl_template: str = "modern",
    accepted_traces: list[dict[str, Any]] | None = None,
    regenerate_sections: list[str] | None = None,
) -> dict[str, Any] | None:
    from agents.generate_docs.graph import run_generate_docs as _run

    return _run(
        chunks=chunks,
        job=job,
        profile=profile,
        contact=contact,
        cv_template=cv_template,
        cl_template=cl_template,
        accepted_traces=accepted_traces,
        regenerate_sections=regenerate_sections,
    )


__all__ = ["run_generate_docs", "GeneratedDocuments", "validate_generated"]

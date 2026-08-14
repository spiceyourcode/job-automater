"""Celery task: GenerateDocs — tailored CV/CL from cv_chunks (HG-9)."""

from __future__ import annotations

import logging
import time
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.generate_docs import run_generate_docs
from celery_app import app
from db import (
    connect,
    load_application,
    load_cv_chunks_for_user,
    load_job_for_user,
    load_profile_for_user,
    save_application_documents,
)

logger = logging.getLogger(__name__)


class GenerateDocsJob(BaseModel):
    application_id: str = Field(..., min_length=36, max_length=36)
    user_id: str = Field(..., min_length=36, max_length=36)
    job_id: str = Field(..., min_length=36, max_length=36)
    accepted_traces: list[dict[str, Any]] = Field(default_factory=list)
    regenerate_sections: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


def process_generate_docs(payload: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    job = GenerateDocsJob.model_validate(payload)

    with connect() as conn:
        app_row = load_application(
            conn, application_id=job.application_id, user_id=job.user_id
        )
        if app_row is None:
            logger.warning("generate_docs_missing_app")
            return {"status": "error", "error": "application_not_found"}
        if str(app_row["job_id"]) != job.job_id:
            return {"status": "error", "error": "job_mismatch"}

        job_row = load_job_for_user(conn, job_id=job.job_id, user_id=job.user_id)
        if job_row is None:
            return {"status": "error", "error": "job_not_found"}

        chunks = load_cv_chunks_for_user(conn, job.user_id)
        if not chunks:
            logger.warning("generate_docs_no_chunks")
            return {"status": "error", "error": "no_cv_chunks"}

        profile = load_profile_for_user(conn, job.user_id)
        cv_template = str(app_row.get("cv_template") or "modern")
        cl_template = str(app_row.get("cl_template") or "modern")
        validated = run_generate_docs(
            chunks=chunks,
            job=job_row,
            profile=profile,
            cv_template=cv_template,
            cl_template=cl_template,
            accepted_traces=job.accepted_traces,
            regenerate_sections=job.regenerate_sections,
        )
        if validated is None:
            # HG-9: never persist ungrounded docs
            return {"status": "error", "error": "grounding_failed"}

        duration_ms = int((time.perf_counter() - started) * 1000)
        save_application_documents(
            conn,
            application_id=job.application_id,
            user_id=job.user_id,
            tailored_cv=validated["tailored_cv"],
            cover_letter=validated["cover_letter"],
            bullet_traces=validated["bullet_traces"],
            model_used=validated.get("model_used") or "heuristic-docs-v1",
            duration_ms=duration_ms,
        )
        # Never log CV/CL body (HG-8)
        logger.info(
            "generate_docs_ok application_id=%s traces=%s ms=%s",
            job.application_id,
            len(validated["bullet_traces"]),
            duration_ms,
        )
        try:
            from tasks.realtime import publish_event

            publish_event(
                job.user_id,
                {
                    "type": "documents_ready",
                    "application_id": job.application_id,
                },
            )
        except Exception:  # noqa: BLE001
            pass
        return {
            "status": "ok",
            "application_id": job.application_id,
            "traces": len(validated["bullet_traces"]),
            "duration_ms": duration_ms,
        }


@app.task(name="tasks.generate_docs", bind=True, max_retries=1, default_retry_delay=20)
def generate_docs(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_generate_docs(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

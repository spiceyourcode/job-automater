"""Celery task: InterviewPrep — Q&A, STAR, negotiation (HG-9)."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.interview_prep import run_interview_prep
from celery_app import app
from db import (
    connect,
    load_application,
    load_cv_chunks_for_user,
    load_job_for_user,
    load_profile_for_user,
    save_interview_prep,
)

logger = logging.getLogger(__name__)


class InterviewPrepJob(BaseModel):
    application_id: str = Field(..., min_length=36, max_length=36)
    user_id: str = Field(..., min_length=36, max_length=36)
    job_id: str = Field(..., min_length=36, max_length=36)

    model_config = {"extra": "forbid"}


def process_interview_prep(payload: dict[str, Any]) -> dict[str, Any]:
    job = InterviewPrepJob.model_validate(payload)
    with connect() as conn:
        app_row = load_application(
            conn, application_id=job.application_id, user_id=job.user_id
        )
        if app_row is None:
            logger.warning("interview_prep_missing_app")
            return {"status": "error", "error": "application_not_found"}
        if str(app_row["job_id"]) != job.job_id:
            save_interview_prep(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                questions=[],
                star_stories=[],
                negotiation=None,
                model_used=None,
                error_code="job_mismatch",
            )
            return {"status": "error", "error": "job_mismatch"}

        job_row = load_job_for_user(conn, job_id=job.job_id, user_id=job.user_id)
        if job_row is None:
            save_interview_prep(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                questions=[],
                star_stories=[],
                negotiation=None,
                model_used=None,
                error_code="job_not_found",
            )
            return {"status": "error", "error": "job_not_found"}

        chunks = load_cv_chunks_for_user(conn, job.user_id)
        if not chunks:
            save_interview_prep(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                questions=[],
                star_stories=[],
                negotiation=None,
                model_used=None,
                error_code="no_cv_chunks",
            )
            logger.warning("interview_prep_no_chunks")
            return {"status": "error", "error": "no_cv_chunks"}

        profile = load_profile_for_user(conn, job.user_id)
        validated = run_interview_prep(
            chunks=chunks, job=job_row, profile=profile
        )
        if validated is None:
            save_interview_prep(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                questions=[],
                star_stories=[],
                negotiation=None,
                model_used=None,
                error_code="grounding_failed",
            )
            logger.warning("interview_prep_grounding_failed")
            return {"status": "error", "error": "grounding_failed"}

        save_interview_prep(
            conn,
            application_id=job.application_id,
            user_id=job.user_id,
            job_id=job.job_id,
            status="ready",
            questions=validated["questions"],
            star_stories=validated["star_stories"],
            negotiation=validated.get("negotiation"),
            model_used=validated.get("model_used") or "heuristic-prep-v1",
        )
        logger.info(
            "interview_prep_ok application_id=%s questions=%s stories=%s",
            job.application_id,
            len(validated["questions"]),
            len(validated["star_stories"]),
        )
        return {
            "status": "ok",
            "application_id": job.application_id,
            "questions": len(validated["questions"]),
            "stories": len(validated["star_stories"]),
        }


@app.task(name="tasks.interview_prep", bind=True, max_retries=1, default_retry_delay=20)
def interview_prep(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_interview_prep(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

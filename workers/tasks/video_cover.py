"""Celery task: VideoCover — spoken script from cv_chunks (HG-9)."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.video_cover import run_video_cover
from celery_app import app
from db import (
    connect,
    load_application,
    load_cv_chunks_for_user,
    load_job_for_user,
    save_video_cover_script,
)

logger = logging.getLogger(__name__)


class VideoCoverJob(BaseModel):
    application_id: str = Field(..., min_length=36, max_length=36)
    user_id: str = Field(..., min_length=36, max_length=36)
    job_id: str = Field(..., min_length=36, max_length=36)

    model_config = {"extra": "forbid"}


def process_video_cover(payload: dict[str, Any]) -> dict[str, Any]:
    job = VideoCoverJob.model_validate(payload)
    with connect() as conn:
        app_row = load_application(
            conn, application_id=job.application_id, user_id=job.user_id
        )
        if app_row is None:
            logger.warning("video_cover_missing_app")
            return {"status": "error", "error": "application_not_found"}
        if str(app_row["job_id"]) != job.job_id:
            save_video_cover_script(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                script=None,
                hook=None,
                close=None,
                chunk_ids=[],
                estimated_seconds=None,
                model_used=None,
                error_code="job_mismatch",
            )
            return {"status": "error", "error": "job_mismatch"}

        job_row = load_job_for_user(conn, job_id=job.job_id, user_id=job.user_id)
        if job_row is None:
            save_video_cover_script(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                script=None,
                hook=None,
                close=None,
                chunk_ids=[],
                estimated_seconds=None,
                model_used=None,
                error_code="job_not_found",
            )
            return {"status": "error", "error": "job_not_found"}

        chunks = load_cv_chunks_for_user(conn, job.user_id)
        if not chunks:
            save_video_cover_script(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                script=None,
                hook=None,
                close=None,
                chunk_ids=[],
                estimated_seconds=None,
                model_used=None,
                error_code="no_cv_chunks",
            )
            logger.warning("video_cover_no_chunks")
            return {"status": "error", "error": "no_cv_chunks"}

        validated = run_video_cover(chunks=chunks, job=job_row)
        if validated is None:
            save_video_cover_script(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                job_id=job.job_id,
                status="failed",
                script=None,
                hook=None,
                close=None,
                chunk_ids=[],
                estimated_seconds=None,
                model_used=None,
                error_code="grounding_failed",
            )
            logger.warning("video_cover_grounding_failed")
            return {"status": "error", "error": "grounding_failed"}

        save_video_cover_script(
            conn,
            application_id=job.application_id,
            user_id=job.user_id,
            job_id=job.job_id,
            status="ready",
            script=validated["script"],
            hook=validated["hook"],
            close=validated["close"],
            chunk_ids=validated["chunk_ids"],
            estimated_seconds=validated["estimated_seconds"],
            model_used=validated.get("model_used") or "heuristic-video-cl-v1",
        )
        logger.info(
            "video_cover_ok application_id=%s seconds=%s",
            job.application_id,
            validated["estimated_seconds"],
        )
        return {
            "status": "ok",
            "application_id": job.application_id,
            "seconds": validated["estimated_seconds"],
        }


@app.task(name="tasks.video_cover", bind=True, max_retries=1, default_retry_delay=20)
def video_cover(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_video_cover(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

"""Celery task: SubmitApplication — Playwright submit after HG-4 approval."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.submit_verify import run_submit_verify
from celery_app import app
from db import (
    connect,
    load_application,
    load_job_for_user,
    load_profile_for_user,
    load_user_contact,
    mark_application_submit_failed,
    mark_application_submitted,
)
from storage import upload_bytes

logger = logging.getLogger(__name__)


class SubmitApplicationJob(BaseModel):
    application_id: str = Field(..., min_length=36, max_length=36)
    user_id: str = Field(..., min_length=36, max_length=36)
    approved_at: str = Field(..., min_length=10)

    model_config = {"extra": "forbid"}


def process_submit_application(payload: dict[str, Any]) -> dict[str, Any]:
    # HG-4 hard gate before any browser work
    if not payload.get("approved_at"):
        logger.warning("submit_rejected reason=missing_approved_at")
        return {"status": "error", "error": "missing_approved_at"}

    try:
        job = SubmitApplicationJob.model_validate(payload)
    except ValidationError:
        logger.warning("submit_rejected reason=invalid_payload")
        return {"status": "error", "error": "invalid_payload"}

    # Validate ISO timestamp
    try:
        datetime.fromisoformat(job.approved_at.replace("Z", "+00:00"))
    except ValueError:
        return {"status": "error", "error": "invalid_approved_at"}

    with connect() as conn:
        app_row = load_application(
            conn, application_id=job.application_id, user_id=job.user_id
        )
        if app_row is None:
            return {"status": "error", "error": "application_not_found"}
        if app_row.get("approved_at") is None:
            logger.warning("submit_rejected reason=row_not_approved")
            return {"status": "error", "error": "not_approved"}

        job_row = load_job_for_user(
            conn, job_id=str(app_row["job_id"]), user_id=job.user_id
        )
        if job_row is None:
            return {"status": "error", "error": "job_not_found"}

        profile = load_profile_for_user(conn, job.user_id) or {}
        contact = load_user_contact(conn, job.user_id) or {}
        # Merge contact onto profile for ATS (email lives on users)
        if contact.get("email"):
            profile = {
                **profile,
                "email": contact["email"],
                "full_name": contact.get("name") or profile.get("full_name"),
            }
            parts = str(contact.get("name") or "").split()
            if parts and not profile.get("first_name"):
                profile["first_name"] = parts[0]
                profile["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""
        result = run_submit_verify(
            application=app_row,
            job=job_row,
            approved_at=job.approved_at,
            profile=profile,
        )
        if result is None:
            return {"status": "error", "error": "empty_result"}

        shot_key: str | None = None
        if result.screenshot_bytes:
            shot_key = (
                f"applications/{job.user_id}/{job.application_id}/"
                f"confirmation.png"
            )
            upload_bytes(
                key=shot_key,
                body=result.screenshot_bytes,
                content_type="image/png",
            )

        if result.status == "submitted":
            if not shot_key:
                # Contract: never mark submitted without screenshot proof
                mark_application_submit_failed(
                    conn,
                    application_id=job.application_id,
                    user_id=job.user_id,
                    error_code="screenshot_required",
                )
                return {"status": "error", "error": "screenshot_required"}
            mark_application_submitted(
                conn,
                application_id=job.application_id,
                user_id=job.user_id,
                submitted_via=result.submitted_via,
                external_application_id=result.external_application_id,
                confirmation_screenshot_url=shot_key,
            )
            logger.info(
                "submit_ok application_id=%s via=%s",
                job.application_id,
                result.submitted_via,
            )
            return {
                "status": "ok",
                "application_id": job.application_id,
                "submitted_via": result.submitted_via,
            }

        err = result.error or result.status
        mark_application_submit_failed(
            conn,
            application_id=job.application_id,
            user_id=job.user_id,
            error_code=err,
            confirmation_screenshot_url=shot_key,
        )
        # User-visible CAPTCHA / failure path — do not crash worker
        logger.warning(
            "submit_failed application_id=%s error=%s",
            job.application_id,
            err,
        )
        return {"status": "error", "error": err}


@app.task(
    name="tasks.submit_application",
    bind=True,
    max_retries=1,
    default_retry_delay=30,
)
def submit_application(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_submit_application(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

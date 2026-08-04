"""Celery task: monitor_email — IMAP/sync ingest + classify (HG-8, no body logs)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.email_classifier import run_email_classifier
from celery_app import app
from db import (
    connect,
    insert_notification,
    list_applications_with_jobs,
    save_email_classification,
    update_application_status,
    upsert_email,
)

logger = logging.getLogger(__name__)


class EmailMessageIn(BaseModel):
    external_id: str = Field(..., min_length=1, max_length=255)
    from_email: str = Field(..., min_length=3, max_length=255)
    from_name: str | None = None
    subject: str | None = None
    snippet: str | None = None
    body_text: str | None = None
    received_at: str | None = None

    model_config = {"extra": "forbid"}


class MonitorEmailJob(BaseModel):
    user_id: str = Field(..., min_length=36, max_length=36)
    messages: list[EmailMessageIn] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


_NOTIFY_TITLES = {
    "interview_invitation": ("Interview invitation", 2),
    "offer": ("Offer received", 3),
    "rejection": ("Application update", 1),
    "application_confirmation": ("Application acknowledged", 0),
}


def process_monitor_email(payload: dict[str, Any]) -> dict[str, Any]:
    job = MonitorEmailJob.model_validate(payload)
    processed = 0
    auto_updates = 0
    manual = 0

    with connect() as conn:
        apps = list_applications_with_jobs(conn, job.user_id)

        for msg in job.messages:
            received = datetime.now(timezone.utc)
            if msg.received_at:
                try:
                    received = datetime.fromisoformat(
                        msg.received_at.replace("Z", "+00:00")
                    )
                except ValueError:
                    pass

            email_id = upsert_email(
                conn,
                user_id=job.user_id,
                external_id=msg.external_id,
                from_email=msg.from_email,
                from_name=msg.from_name,
                subject=msg.subject,
                snippet=msg.snippet,
                body_text=msg.body_text,
                received_at=received,
            )

            # Classifier gets subject/snippet only — never log body (HG-8)
            result = run_email_classifier(
                subject=msg.subject,
                snippet=msg.snippet,
                from_email=msg.from_email,
                applications=apps,
            )
            classification = result["classification"] or {}
            category = classification.get("category", "other")
            confidence = float(classification.get("confidence") or 0)

            if result["auto_apply"] and result["new_status"] and result["application_id"]:
                update_application_status(
                    conn,
                    application_id=result["application_id"],
                    user_id=job.user_id,
                    status=result["new_status"],
                )
                auto_updates += 1
                save_email_classification(
                    conn,
                    email_id=email_id,
                    user_id=job.user_id,
                    category=category,
                    confidence=confidence,
                    classifier_version=result["classifier_version"],
                    application_id=result["application_id"],
                    extracted=classification.get("extracted") or {},
                    processed=True,
                    needs_manual_review=False,
                )
                if result.get("notify"):
                    title, prio = _NOTIFY_TITLES.get(
                        category, ("Application update", 0)
                    )
                    insert_notification(
                        conn,
                        user_id=job.user_id,
                        type_=category,
                        title=title,
                        message=f"Status → {result['new_status']}",
                        data={
                            "application_id": result["application_id"],
                            "email_id": email_id,
                            "category": category,
                            "confidence": confidence,
                        },
                        priority=prio,
                    )
            else:
                manual += 1
                save_email_classification(
                    conn,
                    email_id=email_id,
                    user_id=job.user_id,
                    category=category,
                    confidence=confidence,
                    classifier_version=result["classifier_version"],
                    application_id=result.get("application_id"),
                    extracted=classification.get("extracted") or {},
                    processed=False,
                    needs_manual_review=True,
                )

            processed += 1
            # Log counts only — never subject/body (HG-8)
            logger.info(
                "email_processed category=%s auto=%s",
                category,
                result["auto_apply"],
            )

    return {
        "status": "ok",
        "processed": processed,
        "auto_updates": auto_updates,
        "needs_review": manual,
    }


@app.task(name="tasks.monitor_email", bind=True, max_retries=1, default_retry_delay=20)
def monitor_email(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_monitor_email(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

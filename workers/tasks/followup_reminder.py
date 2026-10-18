"""Follow-up reminders — notify when applications are due (Notifications Phase 2).

Reads ``applications.next_followup_at`` (set by the API on a bulk ``followup``
action or a PATCH meta update) and, for still-active applications whose due time
has passed, inserts an in-app ``followup_reminder`` notification, then advances
the due time by 7 days so the same row is not re-notified.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, ValidationError

from celery_app import app
from db import connect, insert_notification

logger = logging.getLogger(__name__)

ACTIVE_STATUSES = (
    "submitted",
    "approved",
    "pending_approval",
    "acknowledged",
    "screening",
    "interviewing",
)

_FOLLOWUP_INTERVAL = timedelta(days=7)


def load_due_reminders(
    conn: Any,
    now: datetime,
    *,
    force_user_id: str | None = None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT a.id, a.user_id, a.job_id, a.next_followup_at,
               j.company, j.title
        FROM applications a
        JOIN jobs j ON j.id = a.job_id
        WHERE a.next_followup_at IS NOT NULL
          AND a.next_followup_at <= %s
          AND a.status = ANY(%s)
    """
    params: list[Any] = [now, list(ACTIVE_STATUSES)]
    if force_user_id:
        sql += " AND a.user_id = %s::uuid"
        params.append(force_user_id)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall() or [])


def advance_followup(conn: Any, application_id: str, due_at: datetime) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications
            SET next_followup_at = %s
            WHERE id = %s::uuid
            """,
            (due_at + _FOLLOWUP_INTERVAL, application_id),
        )


def process_followup_reminders(
    now_utc: datetime | None = None,
    *,
    force_user_id: str | None = None,
) -> dict[str, int]:
    now = now_utc or datetime.now(timezone.utc)
    notified = 0
    skipped = 0

    with connect() as conn:
        rows = load_due_reminders(conn, now, force_user_id=force_user_id)
        for row in rows:
            application_id = str(row["id"])
            user_id = str(row["user_id"])
            job_id = str(row["job_id"])
            due_at = row.get("next_followup_at")
            company = str(row.get("company") or "Unknown")[:80]
            title = str(row.get("title") or "Role")[:120]
            try:
                insert_notification(
                    conn,
                    user_id=user_id,
                    type_="followup_reminder",
                    title="Time to follow up",
                    message=f"{company} — {title}",
                    data={
                        "application_id": application_id,
                        "job_id": job_id,
                        "due_at": due_at.isoformat() if due_at else None,
                    },
                    priority=1,
                )
                advance_followup(conn, application_id, due_at or now)
                notified += 1
            except Exception:  # noqa: BLE001
                logger.exception(
                    "followup_reminder_notify_failed application_id=%s",
                    application_id,
                )
                skipped += 1

    logger.info("followup_reminder_done notified=%s skipped=%s", notified, skipped)
    return {"notified": notified, "skipped": skipped}


class FollowupReminderJob(BaseModel):
    user_id: str | None = None
    model_config = {"extra": "forbid"}


@app.task(name="tasks.followup_reminder")
def followup_reminder(payload: dict[str, Any] | None = None) -> dict[str, int]:
    user_id = None
    if isinstance(payload, dict):
        try:
            user_id = FollowupReminderJob.model_validate(payload).user_id
        except ValidationError:
            user_id = None
    return process_followup_reminders(force_user_id=user_id)

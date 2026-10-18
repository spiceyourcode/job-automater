"""Purge auto-collected jobs outside the retention window.

Jobs older than :data:`RETENTION_DAYS` (by ``collected_at``) are hard-deleted.
Jobs the user has acted on are exempt: ``applications.job_id`` and
``saved_jobs.job_id`` both cascade on delete, so removing those rows would wipe
the user's application history / saved list. ``job_scores`` cascade with the job
and are intentionally not an exemption (every normalized job gets scored).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from celery_app import app
from db import connect

logger = logging.getLogger(__name__)

RETENTION_DAYS = 5


def purge_old_jobs(now_utc: datetime | None = None) -> dict[str, int]:
    """Delete jobs older than the retention window that have no user activity."""
    now = now_utc or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=RETENTION_DAYS)

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM jobs AS j
                WHERE j.collected_at < %s
                  AND NOT EXISTS (
                    SELECT 1 FROM applications a WHERE a.job_id = j.id
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM saved_jobs s WHERE s.job_id = j.id
                  )
                """,
                (cutoff,),
            )
            deleted = cur.rowcount or 0

    logger.info("purge_old_jobs_done deleted=%s cutoff=%s", deleted, cutoff.isoformat())
    return {"deleted": deleted}


@app.task(name="tasks.purge_old_jobs")
def purge_old_jobs_task(payload: dict | None = None) -> dict[str, int]:
    return purge_old_jobs()

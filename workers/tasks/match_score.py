"""Celery task: dedup + MatchScore for user-owned jobs."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.match_score import run_match_score
from celery_app import app
from db import (
    connect,
    load_jobs_for_user,
    load_profile_for_user,
    mark_job_duplicate,
    mark_job_scored,
    upsert_job_score,
)

logger = logging.getLogger(__name__)


class MatchScoreJob(BaseModel):
    """Matches contracts/queue-payloads.schema.json#MatchScoreJob."""

    job_ids: list[str] = Field(..., min_length=1)
    user_id: str = Field(..., min_length=36, max_length=36)

    model_config = {"extra": "forbid"}


def process_match_score(payload: dict[str, Any]) -> dict[str, Any]:
    job = MatchScoreJob.model_validate(payload)
    scored = 0
    duped = 0
    failed = 0
    skipped = 0

    with connect() as conn:
        profile = load_profile_for_user(conn, job.user_id)
        if profile is None:
            logger.warning("match_score_no_profile")
            return {
                "status": "error",
                "scored": 0,
                "duplicated": 0,
                "failed": len(job.job_ids),
                "skipped": 0,
                "error": "profile_missing",
            }

        # Ownership: only this user's jobs (IDOR)
        targets = load_jobs_for_user(
            conn, user_id=job.user_id, job_ids=job.job_ids
        )
        found = {str(r["id"]) for r in targets}
        for jid in job.job_ids:
            if jid not in found:
                skipped += 1
                logger.warning("match_score_idor_or_missing job_id=%s", jid)

        peers = load_jobs_for_user(conn, user_id=job.user_id, job_ids=None)

        for row in targets:
            jid = str(row["id"])
            # Exclude self from peer list for dedup
            existing = [p for p in peers if str(p["id"]) != jid]
            result = run_match_score(
                user_id=job.user_id,
                profile=profile,
                job=row,
                existing_jobs=existing,
                conn=conn,
            )
            if result.get("duplicate_of"):
                mark_job_duplicate(
                    conn,
                    job_id=jid,
                    user_id=job.user_id,
                    duplicate_of=str(result["duplicate_of"]),
                )
                duped += 1
                continue

            score = result.get("score")
            if not score or not score.get("reasoning"):
                failed += 1
                logger.warning("match_score_rejected_no_reasoning job_id=%s", jid)
                continue
            try:
                upsert_job_score(
                    conn, user_id=job.user_id, job_id=jid, score=score
                )
                mark_job_scored(conn, job_id=jid, user_id=job.user_id)
                scored += 1
            except Exception:  # noqa: BLE001
                failed += 1
                logger.exception("match_score_persist_failed job_id=%s", jid)

    logger.info(
        "match_score_done scored=%s duped=%s failed=%s skipped=%s",
        scored,
        duped,
        failed,
        skipped,
    )
    return {
        "status": "ok",
        "scored": scored,
        "duplicated": duped,
        "failed": failed,
        "skipped": skipped,
    }


@app.task(name="tasks.match_score", bind=True, max_retries=1, default_retry_delay=20)
def match_score(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_match_score(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

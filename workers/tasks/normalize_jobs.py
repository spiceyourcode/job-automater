"""Celery task: normalize jobs_raw → jobs via extract_normalize graph."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from agents.extract_normalize import run_extract_normalize
from celery_app import app
from db import connect, insert_normalized_job, load_jobs_raw, mark_jobs_raw_processed

logger = logging.getLogger(__name__)


class NormalizeJobsJob(BaseModel):
    """Matches contracts/queue-payloads.schema.json#NormalizeJobsJob."""

    job_ids: list[str] = Field(..., min_length=1)
    user_id: str = Field(..., min_length=36, max_length=36)

    model_config = {"extra": "forbid"}


def process_normalize_jobs(payload: dict[str, Any]) -> dict[str, Any]:
    job = NormalizeJobsJob.model_validate(payload)
    ok = 0
    failed = 0
    skipped = 0
    normalized_job_ids: list[str] = []

    with connect() as conn:
        rows = load_jobs_raw(conn, user_id=job.user_id, job_ids=job.job_ids)
        found_ids = {str(r["id"]) for r in rows}
        # Ownership: only rows for this user_id are returned (IDOR safe)
        for raw_id in job.job_ids:
            if raw_id not in found_ids:
                skipped += 1
                logger.warning("normalize_missing_or_forbidden job_id=%s", raw_id)

        for row in rows:
            if row.get("processed"):
                skipped += 1
                continue
            raw_data = row["raw_data"]
            if not isinstance(raw_data, dict):
                mark_jobs_raw_processed(
                    conn,
                    jobs_raw_id=str(row["id"]),
                    error="raw_data is not an object",
                )
                failed += 1
                continue

            source_type = str(row.get("source_type") or raw_data.get("format") or "unknown")
            validated = run_extract_normalize(
                raw_data=raw_data,
                source_type=source_type,
                source_external_id=row.get("source_id"),
                source_url=row.get("source_url"),
                use_llm=False,
            )
            if validated is None:
                # HG-9: never insert unvalidated payload
                mark_jobs_raw_processed(
                    conn,
                    jobs_raw_id=str(row["id"]),
                    error="schema validation failed",
                )
                failed += 1
                continue

            inserted = insert_normalized_job(
                conn,
                user_id=job.user_id,
                source_config_id=str(row["source_config_id"])
                if row.get("source_config_id")
                else None,
                jobs_raw_id=str(row["id"]),
                job=validated.model_dump(mode="json"),
            )
            mark_jobs_raw_processed(conn, jobs_raw_id=str(row["id"]), error=None)
            if inserted:
                ok += 1
                normalized_job_ids.append(inserted)
            else:
                skipped += 1

    if normalized_job_ids:
        from tasks.match_score import match_score

        match_score.delay({"job_ids": normalized_job_ids, "user_id": job.user_id})

    logger.info(
        "normalize_jobs_done user_jobs=%s ok=%s failed=%s skipped=%s",
        len(job.job_ids),
        ok,
        failed,
        skipped,
    )
    return {
        "status": "ok",
        "normalized": ok,
        "failed": failed,
        "skipped": skipped,
        "job_ids": normalized_job_ids,
    }


@app.task(name="tasks.normalize_jobs", bind=True, max_retries=1, default_retry_delay=20)
def normalize_jobs(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_normalize_jobs(data)
    except ValidationError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc

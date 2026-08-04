"""Celery task: collect jobs from a configured source into jobs_raw."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from celery_app import app
from collectors.base import RawJob
from collectors.registry import get_collector
from db import (
    connect,
    dedup_hash,
    insert_jobs_raw,
    load_source,
    mark_source_failed,
    mark_source_success,
)

logger = logging.getLogger(__name__)

_ALLOWED_TYPES = frozenset({"rss", "api", "imap"})


class CollectSourceJob(BaseModel):
    """Matches contracts/queue-payloads.schema.json#CollectSourceJob (phase-2 subset)."""

    source_id: str = Field(..., min_length=36, max_length=36)
    user_id: str = Field(..., min_length=36, max_length=36)
    source_type: str

    model_config = {"extra": "forbid"}


class CollectFailed(Exception):
    """Collector/business failure already persisted to source_configs — do not retry."""


def _sanitize_error(exc: BaseException) -> str:
    """Strip likely secrets from error strings before DB/logs (HG-8)."""
    text = f"{type(exc).__name__}: {exc}"
    lowered = text.lower()
    for token in ("password", "token", "bearer", "api_key", "authorization", "secret"):
        if token in lowered:
            return f"{type(exc).__name__}: [redacted]"
    return text[:500]


def _raw_jobs_to_rows(jobs: list[RawJob]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for job in jobs:
        rows.append(
            {
                "source_id": job.source_external_id,
                "source_url": job.source_url,
                "raw_data": job.raw_data,
                "dedup_hash": dedup_hash(job.dedup_parts)
                if job.dedup_parts
                else dedup_hash([job.source_external_id]),
            }
        )
    return rows


async def _run_collector(source_type: str, config: dict[str, Any]) -> list[RawJob]:
    collector = get_collector(source_type)
    return await collector.collect(config)


def _fail(
    conn: Any,
    *,
    source_id: str,
    user_id: str,
    exc: BaseException,
    started: float,
) -> None:
    duration_ms = int((time.perf_counter() - started) * 1000)
    err = _sanitize_error(exc)
    mark_source_failed(
        conn,
        source_id=source_id,
        user_id=user_id,
        error=err,
        duration_ms=duration_ms,
    )
    conn.commit()
    logger.error(
        "collect_source_failed source_id=%s error=%s",
        source_id,
        err,
    )


def process_collect_source(payload: dict[str, Any]) -> dict[str, Any]:
    """Core collect logic — callable from Celery task or tests."""
    started = time.perf_counter()
    try:
        job = CollectSourceJob.model_validate(payload)
    except ValidationError as exc:
        logger.warning("collect_source_invalid_payload errors=%s", len(exc.errors()))
        raise

    if job.source_type not in _ALLOWED_TYPES:
        raise ValueError(f"Unsupported source_type for phase 2: {job.source_type}")

    with connect() as conn:
        source = load_source(conn, job.source_id, job.user_id)
        if source is None:
            logger.warning("collect_source_missing source_id=%s", job.source_id)
            raise ValueError("Source not found for user")

        try:
            if source["source_type"] != job.source_type:
                raise ValueError("source_type mismatch with stored config")
            if not source["is_active"]:
                raise ValueError("Source is inactive")

            config = source["config"]
            if not isinstance(config, dict):
                config = {}

            raw_jobs = asyncio.run(_run_collector(job.source_type, config))
            rows = _raw_jobs_to_rows(raw_jobs)
            inserted = insert_jobs_raw(
                conn,
                user_id=job.user_id,
                source_config_id=job.source_id,
                jobs=rows,
            )
            duration_ms = int((time.perf_counter() - started) * 1000)
            mark_source_success(
                conn,
                source_id=job.source_id,
                user_id=job.user_id,
                jobs_found=len(raw_jobs),
                jobs_inserted=inserted,
                duration_ms=duration_ms,
            )
            logger.info(
                "collect_source_ok source_id=%s type=%s found=%s inserted=%s ms=%s",
                job.source_id,
                job.source_type,
                len(raw_jobs),
                inserted,
                duration_ms,
            )
            return {
                "status": "success",
                "jobs_found": len(raw_jobs),
                "jobs_inserted": inserted,
                "duration_ms": duration_ms,
            }
        except Exception as exc:
            _fail(
                conn,
                source_id=job.source_id,
                user_id=job.user_id,
                exc=exc,
                started=started,
            )
            raise CollectFailed(_sanitize_error(exc)) from exc


@app.task(name="tasks.collect_source", bind=True, max_retries=1, default_retry_delay=30)
def collect_source(
    self,
    payload: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """CollectSourceJob entrypoint — payload dict or keyword fields."""
    data: dict[str, Any] = {}
    if isinstance(payload, dict):
        data.update(payload)
    data.update(kwargs)
    try:
        return process_collect_source(data)
    except (ValidationError, ValueError, CollectFailed):
        # Already recorded or not retryable (missing source / bad payload)
        raise
    except Exception as exc:
        # Unexpected infrastructure errors only
        raise self.retry(exc=exc) from exc

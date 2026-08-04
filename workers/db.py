"""Postgres helpers for workers — psycopg sync (Celery-friendly)."""

from __future__ import annotations

import hashlib
import json
from contextlib import contextmanager
from typing import Any, Generator

import psycopg
from psycopg.rows import dict_row

from config import settings


@contextmanager
def connect() -> Generator[psycopg.Connection, None, None]:
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_source(conn: psycopg.Connection, source_id: str, user_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, source_type, name, config, is_active,
                   consecutive_failures, total_jobs_collected
            FROM source_configs
            WHERE id = %s::uuid AND user_id = %s::uuid
            LIMIT 1
            """,
            (source_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def dedup_hash(parts: list[str]) -> str:
    blob = "|".join(p.strip().lower() for p in parts if p)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def insert_jobs_raw(
    conn: psycopg.Connection,
    *,
    user_id: str,
    source_config_id: str,
    jobs: list[dict[str, Any]],
) -> int:
    """Insert raw jobs; skip duplicates on (source_config_id, source_id). Returns inserted count."""
    if not jobs:
        return 0
    inserted = 0
    with conn.cursor() as cur:
        for job in jobs:
            cur.execute(
                """
                INSERT INTO jobs_raw (
                    source_config_id, user_id, source_id, source_url,
                    raw_data, dedup_hash
                ) VALUES (
                    %s::uuid, %s::uuid, %s, %s, %s::jsonb, %s
                )
                ON CONFLICT (source_config_id, source_id) DO NOTHING
                RETURNING id
                """,
                (
                    source_config_id,
                    user_id,
                    job["source_id"],
                    job.get("source_url"),
                    json.dumps(job["raw_data"]),
                    job.get("dedup_hash"),
                ),
            )
            if cur.fetchone():
                inserted += 1
    return inserted


def mark_source_success(
    conn: psycopg.Connection,
    *,
    source_id: str,
    user_id: str,
    jobs_found: int,
    jobs_inserted: int,
    duration_ms: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE source_configs SET
                last_run_at = NOW(),
                last_run_status = 'success',
                last_run_jobs_found = %s,
                last_run_duration_ms = %s,
                last_error = NULL,
                consecutive_failures = 0,
                total_jobs_collected = total_jobs_collected + %s,
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (jobs_found, duration_ms, jobs_inserted, source_id, user_id),
        )


def mark_source_failed(
    conn: psycopg.Connection,
    *,
    source_id: str,
    user_id: str,
    error: str,
    duration_ms: int,
) -> None:
    # Truncate — never store secrets; caller must sanitize
    safe_error = error[:500]
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE source_configs SET
                last_run_at = NOW(),
                last_run_status = 'failed',
                last_run_duration_ms = %s,
                last_error = %s,
                consecutive_failures = consecutive_failures + 1,
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (duration_ms, safe_error, source_id, user_id),
        )

"""Postgres helpers for workers — psycopg sync (Celery-friendly)."""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.error
import urllib.request
from contextlib import contextmanager
from typing import Any, Generator

import psycopg
from psycopg.rows import dict_row

from config import settings

logger = logging.getLogger(__name__)


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
) -> list[str]:
    """Insert raw jobs; skip duplicates. Returns list of inserted UUIDs."""
    if not jobs:
        return []
    inserted_ids: list[str] = []
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
            row = cur.fetchone()
            if row:
                inserted_ids.append(str(row["id"]))
    return inserted_ids


def load_jobs_raw(
    conn: psycopg.Connection,
    *,
    user_id: str,
    job_ids: list[str],
) -> list[dict[str, Any]]:
    if not job_ids:
        return []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT jr.id, jr.user_id, jr.source_config_id, jr.source_id,
                   jr.source_url, jr.raw_data, jr.processed,
                   sc.source_type
            FROM jobs_raw jr
            LEFT JOIN source_configs sc ON sc.id = jr.source_config_id
            WHERE jr.user_id = %s::uuid
              AND jr.id = ANY(%s::uuid[])
            """,
            (user_id, job_ids),
        )
        return [dict(r) for r in cur.fetchall()]


def insert_normalized_job(
    conn: psycopg.Connection,
    *,
    user_id: str,
    source_config_id: str | None,
    jobs_raw_id: str,
    job: dict[str, Any],
) -> str | None:
    """Insert validated job. Returns id or None if duplicate conflict."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (
                user_id, source, source_id, source_url, source_config_id,
                jobs_raw_id, company, title, location, is_remote, remote_type,
                employment_type, experience_level, salary_min, salary_max,
                salary_currency, salary_period, description, requirements,
                responsibilities, benefits, nice_to_have, application_url,
                application_email, application_method, tags, tech_stack,
                keywords, field_confidence, status
            ) VALUES (
                %s::uuid, %s, %s, %s, %s::uuid,
                %s::uuid, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s::jsonb, %s::jsonb,
                %s::jsonb, %s::jsonb, 'new'
            )
            ON CONFLICT (user_id, source, source_id) DO NOTHING
            RETURNING id
            """,
            (
                user_id,
                job["source"],
                job.get("source_id"),
                job.get("source_url"),
                source_config_id,
                jobs_raw_id,
                job["company"],
                job["title"],
                job.get("location"),
                job.get("is_remote", False),
                job.get("remote_type"),
                job.get("employment_type"),
                job.get("experience_level"),
                job.get("salary_min"),
                job.get("salary_max"),
                job.get("salary_currency") or "USD",
                job.get("salary_period") or "yearly",
                job.get("description"),
                job.get("requirements"),
                job.get("responsibilities"),
                job.get("benefits"),
                job.get("nice_to_have"),
                job.get("application_url"),
                job.get("application_email"),
                job.get("application_method"),
                json.dumps(job.get("tags") or []),
                json.dumps(job.get("tech_stack") or []),
                json.dumps(job.get("keywords") or []),
                json.dumps(job.get("field_confidence") or {}),
            ),
        )
        row = cur.fetchone()
        return str(row["id"]) if row else None


def mark_jobs_raw_processed(
    conn: psycopg.Connection,
    *,
    jobs_raw_id: str,
    error: str | None = None,
) -> None:
    with conn.cursor() as cur:
        if error:
            cur.execute(
                """
                UPDATE jobs_raw SET
                    processed = true,
                    processed_at = NOW(),
                    processing_error = %s
                WHERE id = %s::uuid
                """,
                (error[:500], jobs_raw_id),
            )
        else:
            cur.execute(
                """
                UPDATE jobs_raw SET
                    processed = true,
                    processed_at = NOW(),
                    processing_error = NULL
                WHERE id = %s::uuid
                """,
                (jobs_raw_id,),
            )


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
        cur.execute(
            """
            UPDATE source_runs SET
                status = 'success',
                jobs_found = %s,
                duration_ms = %s,
                error = NULL,
                completed_at = NOW()
            WHERE id = (
                SELECT id FROM source_runs
                WHERE source_config_id = %s::uuid
                  AND user_id = %s::uuid
                  AND status IN ('queued', 'running')
                ORDER BY started_at DESC
                LIMIT 1
            )
            """,
            (jobs_found, duration_ms, source_id, user_id),
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
        cur.execute(
            """
            UPDATE source_runs SET
                status = 'failed',
                duration_ms = %s,
                error = %s,
                completed_at = NOW()
            WHERE id = (
                SELECT id FROM source_runs
                WHERE source_config_id = %s::uuid
                  AND user_id = %s::uuid
                  AND status IN ('queued', 'running')
                ORDER BY started_at DESC
                LIMIT 1
            )
            """,
            (duration_ms, safe_error, source_id, user_id),
        )


def load_profile_for_user(
    conn: psycopg.Connection, user_id: str
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM profiles
            WHERE user_id = %s::uuid
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def load_user_contact(
    conn: psycopg.Connection, user_id: str
) -> dict[str, Any] | None:
    """Email + display name for ATS apply — never log values (HG-8)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, name
            FROM users
            WHERE id = %s::uuid AND deleted_at IS NULL
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def load_jobs_for_user(
    conn: psycopg.Connection,
    *,
    user_id: str,
    job_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        if job_ids:
            cur.execute(
                """
                SELECT id, user_id, source, source_id, title, company, location,
                       is_remote, remote_type, employment_type, experience_level,
                       salary_min, salary_max, salary_currency, description,
                       requirements, tags, tech_stack, keywords, is_duplicate,
                       duplicate_of, status
                FROM jobs
                WHERE user_id = %s::uuid
                  AND id = ANY(%s::uuid[])
                """,
                (user_id, job_ids),
            )
        else:
            cur.execute(
                """
                SELECT id, user_id, source, source_id, title, company, location,
                       is_remote, remote_type, employment_type, experience_level,
                       salary_min, salary_max, salary_currency, description,
                       requirements, tags, tech_stack, keywords, is_duplicate,
                       duplicate_of, status
                FROM jobs
                WHERE user_id = %s::uuid
                  AND is_duplicate = false
                ORDER BY collected_at DESC
                LIMIT 500
                """,
                (user_id,),
            )
        return [dict(r) for r in cur.fetchall()]


def mark_job_duplicate(
    conn: psycopg.Connection,
    *,
    job_id: str,
    user_id: str,
    duplicate_of: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET
                is_duplicate = true,
                duplicate_of = %s::uuid,
                status = 'archived',
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (duplicate_of, job_id, user_id),
        )


def upsert_job_score(
    conn: psycopg.Connection,
    *,
    user_id: str,
    job_id: str,
    score: dict[str, Any],
) -> str:
    """Insert/update score. Caller must ensure job belongs to user_id."""
    reasoning = (score.get("reasoning") or "").strip()
    if len(reasoning) < 20:
        raise ValueError("reasoning required before persist")
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO job_scores (
                job_id, user_id, overall_score, skill_match, experience_match,
                location_match, salary_match, culture_match, weights,
                matched_skills, missing_skills, nice_to_have_skills,
                reasoning, confidence, model_used, prompt_version
            ) VALUES (
                %s::uuid, %s::uuid, %s, %s, %s,
                %s, %s, %s, %s::jsonb,
                %s::jsonb, %s::jsonb, %s::jsonb,
                %s, %s, %s, %s
            )
            ON CONFLICT (job_id, user_id) DO UPDATE SET
                overall_score = EXCLUDED.overall_score,
                skill_match = EXCLUDED.skill_match,
                experience_match = EXCLUDED.experience_match,
                location_match = EXCLUDED.location_match,
                salary_match = EXCLUDED.salary_match,
                culture_match = EXCLUDED.culture_match,
                weights = EXCLUDED.weights,
                matched_skills = EXCLUDED.matched_skills,
                missing_skills = EXCLUDED.missing_skills,
                nice_to_have_skills = EXCLUDED.nice_to_have_skills,
                reasoning = EXCLUDED.reasoning,
                confidence = EXCLUDED.confidence,
                model_used = EXCLUDED.model_used,
                scored_at = NOW()
            RETURNING id
            """,
            (
                job_id,
                user_id,
                score["overall_score"],
                score.get("skill_match"),
                score.get("experience_match"),
                score.get("location_match"),
                score.get("salary_match"),
                score.get("culture_match"),
                json.dumps(score.get("weights") or {}),
                json.dumps(score.get("matched_skills") or []),
                json.dumps(score.get("missing_skills") or []),
                json.dumps(score.get("nice_to_have_skills") or []),
                reasoning,
                score.get("confidence"),
                score.get("model_used") or "heuristic-v1",
                score.get("prompt_version"),
            ),
        )
        row = cur.fetchone()
        return str(row["id"])


def mark_job_scored(conn: psycopg.Connection, *, job_id: str, user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE jobs SET status = 'scored', updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (job_id, user_id),
        )


def load_cv_chunks_for_user(
    conn: psycopg.Connection, user_id: str
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, content, section_type, chunk_index
            FROM cv_chunks
            WHERE user_id = %s::uuid
            ORDER BY chunk_index
            LIMIT 100
            """,
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def load_application(
    conn: psycopg.Connection, *, application_id: str, user_id: str
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT *
            FROM applications
            WHERE id = %s::uuid AND user_id = %s::uuid
            LIMIT 1
            """,
            (application_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def load_job_for_user(
    conn: psycopg.Connection, *, job_id: str, user_id: str
) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, title, company, location, description, requirements,
                   is_remote, employment_type, source, application_url, source_url
            FROM jobs
            WHERE id = %s::uuid AND user_id = %s::uuid
            LIMIT 1
            """,
            (job_id, user_id),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def save_application_documents(
    conn: psycopg.Connection,
    *,
    application_id: str,
    user_id: str,
    tailored_cv: str,
    cover_letter: str,
    bullet_traces: list[dict[str, Any]],
    model_used: str,
    duration_ms: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications SET
                tailored_cv_content = %s,
                cover_letter_content = %s,
                bullet_traces = %s::jsonb,
                generation_model = %s,
                generation_duration_ms = %s,
                status = 'draft',
                documents_reviewed_at = NULL,
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (
                tailored_cv,
                cover_letter,
                json.dumps(bullet_traces),
                model_used,
                duration_ms,
                application_id,
                user_id,
            ),
        )


def mark_application_submitted(
    conn: psycopg.Connection,
    *,
    application_id: str,
    user_id: str,
    submitted_via: str,
    external_application_id: str | None,
    confirmation_screenshot_url: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications SET
                status = 'submitted',
                submitted_via = %s,
                external_application_id = %s,
                confirmation_screenshot_url = %s,
                submitted_at = NOW(),
                submit_error = NULL,
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (
                submitted_via,
                external_application_id,
                confirmation_screenshot_url,
                application_id,
                user_id,
            ),
        )


def mark_application_submit_failed(
    conn: psycopg.Connection,
    *,
    application_id: str,
    user_id: str,
    error_code: str,
    confirmation_screenshot_url: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications SET
                status = 'submit_failed',
                submit_error = %s,
                confirmation_screenshot_url = COALESCE(%s, confirmation_screenshot_url),
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (
                error_code[:100],
                confirmation_screenshot_url,
                application_id,
                user_id,
            ),
        )


def list_applications_with_jobs(
    conn: psycopg.Connection, user_id: str
) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.status, a.job_id, j.company, j.title
            FROM applications a
            JOIN jobs j ON j.id = a.job_id
            WHERE a.user_id = %s::uuid
            ORDER BY a.updated_at DESC
            """,
            (user_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def upsert_email(
    conn: psycopg.Connection,
    *,
    user_id: str,
    external_id: str,
    from_email: str,
    from_name: str | None,
    subject: str | None,
    snippet: str | None,
    body_text: str | None,
    received_at: Any,
    provider: str = "imap",
) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO emails (
                user_id, external_id, from_email, from_name, subject, snippet,
                body_text, received_at, provider
            ) VALUES (
                %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (user_id, external_id) DO UPDATE SET
                subject = EXCLUDED.subject,
                snippet = EXCLUDED.snippet
            RETURNING id
            """,
            (
                user_id,
                external_id,
                from_email,
                from_name,
                subject,
                snippet,
                body_text,
                received_at,
                provider,
            ),
        )
        row = cur.fetchone()
        assert row is not None
        return str(row["id"])


def save_email_classification(
    conn: psycopg.Connection,
    *,
    email_id: str,
    user_id: str,
    category: str,
    confidence: float,
    classifier_version: str,
    application_id: str | None,
    extracted: dict[str, Any],
    processed: bool,
    needs_manual_review: bool,
    processing_error: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE emails SET
                category = %s,
                confidence = %s,
                classified_at = NOW(),
                classifier_version = %s,
                application_id = %s::uuid,
                extracted_data = %s::jsonb,
                processed = %s,
                processed_at = CASE WHEN %s THEN NOW() ELSE processed_at END,
                needs_manual_review = %s,
                processing_error = %s
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (
                category,
                confidence,
                classifier_version,
                application_id,
                json.dumps(extracted),
                processed,
                processed,
                needs_manual_review,
                processing_error,
                email_id,
                user_id,
            ),
        )


def update_application_status(
    conn: psycopg.Connection,
    *,
    application_id: str,
    user_id: str,
    status: str,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE applications SET
                status = %s,
                updated_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (status, application_id, user_id),
        )


def insert_notification(
    conn: psycopg.Connection,
    *,
    user_id: str,
    type_: str,
    title: str,
    message: str,
    data: dict[str, Any],
    priority: int = 0,
) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO notifications (user_id, type, title, message, data, priority)
            VALUES (%s::uuid, %s, %s, %s, %s::jsonb, %s)
            RETURNING id
            """,
            (user_id, type_, title, message, json.dumps(data), priority),
        )
        row = cur.fetchone()
        assert row is not None
        nid = str(row["id"])
    _maybe_dispatch_webhooks(conn, user_id=user_id, type_=type_, title=title)
    return nid


def _maybe_dispatch_webhooks(
    conn: psycopg.Connection,
    *,
    user_id: str,
    type_: str,
    title: str,
) -> None:
    """POST Slack/Telegram if enabled. Never logs URL or payload (HG-8)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT preferences, slack_webhook_url, telegram_webhook_url
            FROM notification_preferences
            WHERE user_id = %s::uuid
            LIMIT 1
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        return
    prefs = row.get("preferences") or {}
    if isinstance(prefs, str):
        try:
            prefs = json.loads(prefs)
        except json.JSONDecodeError:
            prefs = {}
    channel = prefs.get(type_) or {}
    if channel.get("slack") and row.get("slack_webhook_url"):
        _post_webhook(str(row["slack_webhook_url"]), title, "slack")
    if channel.get("telegram") and row.get("telegram_webhook_url"):
        _post_webhook(str(row["telegram_webhook_url"]), title, "telegram")


def _post_webhook(url: str, title: str, channel: str) -> None:
    req = urllib.request.Request(
        url,
        data=json.dumps({"text": title}).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=5)  # noqa: S310
        logger.info("webhook_sent channel=%s", channel)
    except (urllib.error.URLError, TimeoutError, OSError):
        logger.warning("webhook_failed channel=%s", channel)

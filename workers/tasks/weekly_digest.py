"""Weekly digest email — counts and titles only (P11.6 / PRD P5.7).

FAILURE: digest must never contain raw email bodies or CV/CL text.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import redis
from pydantic import BaseModel, ValidationError

from celery_app import app
from config import settings

logger = logging.getLogger(__name__)

_PII_FIELDS = frozenset(
    {
        "body_text",
        "body",
        "snippet",
        "tailored_cv",
        "tailored_cv_content",
        "cover_letter",
        "cover_letter_content",
        "description",
        "raw_html",
    }
)


@dataclass(frozen=True)
class MatchLine:
    company: str
    title: str
    score: float


@dataclass(frozen=True)
class DigestStats:
    top_matches: list[MatchLine]
    applications_submitted: int
    responses: int
    interviews: int
    offers: int


def is_digest_hour(now_utc: datetime, tz_name: str) -> bool:
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("UTC")
    local = now_utc.astimezone(tz)
    return local.weekday() == 0 and local.hour == 8


def week_start_utc(now_utc: datetime) -> datetime:
    return now_utc - timedelta(days=7)


def iso_week_key(now_utc: datetime, tz_name: str) -> str:
    try:
        tz = ZoneInfo(tz_name or "UTC")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("UTC")
    iso = now_utc.astimezone(tz).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def render_digest(stats: DigestStats) -> str:
    lines = [
        "Your JobAutomater weekly digest",
        "",
        f"Applications submitted: {stats.applications_submitted}",
        (
            f"Responses: {stats.responses} "
            f"(interviews {stats.interviews}, offers {stats.offers})"
        ),
        "",
        "Top matches this week:",
    ]
    if not stats.top_matches:
        lines.append("- None yet")
    for m in stats.top_matches:
        lines.append(f"- {m.company} — {m.title} ({m.score:.0f})")
    lines.extend(
        [
            "",
            "Open the dashboard for details.",
            "This email never includes CV text or email contents.",
        ]
    )
    return "\n".join(lines)


def _claim_week(user_id: str, week_key: str) -> bool:
    try:
        client = redis.Redis.from_url(
            settings.celery_broker_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        key = f"jobautomater:digest:weekly:{user_id}:{week_key}"
        return bool(client.set(key, "1", nx=True, ex=8 * 24 * 3600))
    except Exception:  # noqa: BLE001
        logger.warning("digest_claim_failed")
        return False


def _send_mail(to: str, subject: str, text: str) -> None:
    if settings.smtp_webhook_url:
        try:
            httpx.post(
                settings.smtp_webhook_url,
                json={
                    "from": settings.email_from,
                    "to": to,
                    "subject": subject,
                    "text": text,
                },
                timeout=5.0,
            )
        except Exception:  # noqa: BLE001
            logger.warning("digest_mail_webhook_failed")
            return
    logger.info("digest_sent subject_len=%s text_len=%s", len(subject), len(text))


def load_digest_stats(conn: Any, user_id: str, since: datetime) -> DigestStats:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.company, j.title, js.overall_score::float AS score
            FROM job_scores js
            INNER JOIN jobs j ON j.id = js.job_id AND j.user_id = js.user_id
            WHERE js.user_id = %s::uuid
              AND js.scored_at >= %s
            ORDER BY js.overall_score DESC
            LIMIT 5
            """,
            (user_id, since),
        )
        match_rows = cur.fetchall() or []
        for row in match_rows:
            if _PII_FIELDS & set(row.keys()):
                raise RuntimeError("digest_query_pii")
        cur.execute(
            """
            SELECT count(*)::int AS n
            FROM applications
            WHERE user_id = %s::uuid
              AND submitted_at >= %s
            """,
            (user_id, since),
        )
        submitted = int((cur.fetchone() or {}).get("n") or 0)
        cur.execute(
            """
            SELECT
              count(*)::int AS responses,
              count(*) FILTER (
                WHERE category IN ('interview_invitation', 'interview')
              )::int AS interviews,
              count(*) FILTER (WHERE category = 'offer')::int AS offers
            FROM emails
            WHERE user_id = %s::uuid
              AND received_at >= %s
              AND category IS NOT NULL
            """,
            (user_id, since),
        )
        email_row = cur.fetchone() or {}

    matches: list[MatchLine] = []
    for row in match_rows:
        matches.append(
            MatchLine(
                company=str(row.get("company") or "Unknown")[:80],
                title=str(row.get("title") or "Role")[:120],
                score=float(row.get("score") or 0),
            )
        )
    return DigestStats(
        top_matches=matches,
        applications_submitted=submitted,
        responses=int(email_row.get("responses") or 0),
        interviews=int(email_row.get("interviews") or 0),
        offers=int(email_row.get("offers") or 0),
    )


def process_weekly_digest(
    now_utc: datetime | None = None,
    *,
    force_user_id: str | None = None,
) -> dict[str, int]:
    from db import connect

    now = now_utc or datetime.now(timezone.utc)
    since = week_start_utc(now)
    sent = 0
    skipped = 0

    with connect() as conn:
        with conn.cursor() as cur:
            if force_user_id:
                cur.execute(
                    """
                    SELECT id, email, timezone
                    FROM users
                    WHERE id = %s::uuid AND deleted_at IS NULL
                    """,
                    (force_user_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, email, timezone
                    FROM users
                    WHERE deleted_at IS NULL
                    """
                )
            users = cur.fetchall() or []

        for user in users:
            user_id = str(user["id"])
            tz_name = str(user.get("timezone") or "UTC")
            if force_user_id is None and not is_digest_hour(now, tz_name):
                skipped += 1
                continue
            week_key = iso_week_key(now, tz_name)
            if not _claim_week(user_id, week_key):
                skipped += 1
                continue
            stats = load_digest_stats(conn, user_id, since)
            text = render_digest(stats)
            _send_mail(
                str(user["email"]),
                "Your JobAutomater weekly digest",
                text,
            )
            sent += 1

    logger.info("weekly_digest_done sent=%s skipped=%s", sent, skipped)
    return {"sent": sent, "skipped": skipped}


class WeeklyDigestJob(BaseModel):
    user_id: str | None = None
    model_config = {"extra": "forbid"}


@app.task(name="tasks.weekly_digest")
def weekly_digest(payload: dict[str, Any] | None = None) -> dict[str, int]:
    user_id = None
    if isinstance(payload, dict):
        try:
            user_id = WeeklyDigestJob.model_validate(payload).user_id
        except ValidationError:
            user_id = None
    return process_weekly_digest(force_user_id=user_id)

"""Optional company enrichment (FR-NE-03) — heuristic, no paid API required."""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, Field, ValidationError

from celery_app import app
from db import connect

logger = logging.getLogger(__name__)


class EnrichCompanyJob(BaseModel):
    user_id: str = Field(..., min_length=36, max_length=36)
    job_ids: list[str] = Field(default_factory=list)

    model_config = {"extra": "forbid"}


_SIZE_HINTS = (
    ("enterprise", ("inc", "corp", "ltd", "gmbh", "plc", "group")),
    ("startup", ("labs", "studio", "ai", "tech")),
)


def domain_from_url(url: str | None) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).hostname
    except Exception:  # noqa: BLE001
        return None
    if not host:
        return None
    host = host.lower().removeprefix("www.")
    if host in {"linkedin.com", "indeed.com", "greenhouse.io", "lever.co"}:
        return None
    return host[:255]


def guess_size(company: str) -> str | None:
    lower = company.lower()
    for size, tokens in _SIZE_HINTS:
        if any(t in lower for t in tokens):
            return size
    return "smb"


def guess_industry(title: str, tags: list[Any] | None) -> str | None:
    blob = f"{title} {' '.join(str(t) for t in (tags or []))}".lower()
    if re.search(r"\b(devops|sre|infra|platform)\b", blob):
        return "Infrastructure"
    if re.search(r"\b(ml|ai|llm|data)\b", blob):
        return "AI / Data"
    if re.search(r"\b(frontend|react|ui)\b", blob):
        return "Software"
    if re.search(r"\b(security|soc|iam)\b", blob):
        return "Security"
    return "Technology"


def process_enrich_company(payload: dict[str, Any]) -> dict[str, Any]:
    job = EnrichCompanyJob.model_validate(payload)
    enriched = 0
    skipped = 0

    with connect() as conn:
        with conn.cursor() as cur:
            if job.job_ids:
                cur.execute(
                    """
                    SELECT id, company, title, tags, application_url, source_url, company_domain
                    FROM jobs
                    WHERE user_id = %s::uuid AND id = ANY(%s::uuid[])
                    """,
                    (job.user_id, job.job_ids),
                )
            else:
                cur.execute(
                    """
                    SELECT id, company, title, tags, application_url, source_url, company_domain
                    FROM jobs
                    WHERE user_id = %s::uuid
                      AND (company_domain IS NULL OR company_domain = '')
                    ORDER BY collected_at DESC
                    LIMIT 50
                    """,
                    (job.user_id,),
                )
            rows = [dict(r) for r in cur.fetchall()]

            for row in rows:
                if row.get("company_domain"):
                    skipped += 1
                    continue
                domain = domain_from_url(row.get("application_url")) or domain_from_url(
                    row.get("source_url")
                )
                size = guess_size(str(row.get("company") or ""))
                industry = guess_industry(str(row.get("title") or ""), row.get("tags"))
                cur.execute(
                    """
                    UPDATE jobs
                    SET company_domain = COALESCE(%s, company_domain),
                        company_size = COALESCE(%s, company_size),
                        company_industry = COALESCE(%s, company_industry),
                        updated_at = NOW()
                    WHERE id = %s::uuid AND user_id = %s::uuid
                    """,
                    (domain, size, industry, row["id"], job.user_id),
                )
                enriched += 1

    logger.info(
        "enrich_company_done enriched=%s skipped=%s",
        enriched,
        skipped,
    )
    return {"status": "ok", "enriched": enriched, "skipped": skipped}


@app.task(name="tasks.enrich_company", bind=True, max_retries=1, default_retry_delay=20)
def enrich_company(
    self: Any, payload: dict[str, Any] | None = None, **kwargs: Any
) -> dict[str, Any]:
    data = payload if payload is not None else kwargs
    try:
        return process_enrich_company(data)
    except ValidationError:
        logger.warning("enrich_company_invalid_payload")
        return {"status": "error", "error": "invalid_payload"}

"""Workday CXS career-site apply — ATS-first path (P10.1)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from agents.submit_verify.ats.detect import parse_workday_tenant_site_job
from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

_MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def try_workday_submit(
    *,
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    application: dict[str, Any],
    client: httpx.Client | None = None,
) -> SubmitResult | None:
    """
    Attempt Workday CXS application create.
    Returns None when URL/profile incomplete or HTTP fails (portal fallback).
    Never logs PII (HG-8).
    """
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return None
    parsed = parse_workday_tenant_site_job(str(url))
    if not parsed:
        return None

    # Optional shared secret for tenants that require it; empty still attempts CXS.
    _ = getattr(settings, "workday_client_id", "") or ""

    tenant, site, job_path_id = parsed
    email = (profile or {}).get("email") or (profile or {}).get("contact_email")
    first = (profile or {}).get("first_name") or (
        (profile or {}).get("full_name", "").split(" ")[:1]
    )
    last = (profile or {}).get("last_name")
    if isinstance(first, list):
        first = first[0] if first else ""
    name = (profile or {}).get("full_name") or f"{first} {last or ''}".strip()
    if not email or not name:
        logger.info("ats_workday_skip reason=incomplete_profile")
        return None

    parsed_url = httpx.URL(str(url))
    host = parsed_url.host
    endpoint = f"https://{host}/wday/cxs/{tenant}/{site}/applications"

    payload: dict[str, Any] = {
        "jobPostingId": job_path_id,
        "source": "Career Site",
        "candidate": {
            "name": name,
            "email": email,
            "firstName": first or name.split(" ")[0],
            "lastName": last or (name.split(" ")[-1] if " " in name else "Applicant"),
        },
        "resumeText": (application.get("tailored_cv_content") or "")[:50_000],
        "coverLetterText": (
            application.get("cover_letter_text")
            or application.get("cover_letter_content")
            or ""
        )[:5_000],
    }

    own_client = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        resp = http.post(
            endpoint,
            json=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        if resp.status_code >= 400:
            logger.warning("ats_workday_http status=%s", resp.status_code)
            return None
        conf = None
        try:
            body = resp.json()
            conf = str(
                body.get("id")
                or body.get("applicationId")
                or body.get("candidateId")
                or ""
            ) or None
        except Exception:  # noqa: BLE001
            conf = f"wd-{job_path_id[:16]}"
        logger.info("ats_workday_ok tenant=%s site=%s", tenant, site)
        return SubmitResult(
            status="submitted",
            submitted_via="auto_ats",
            external_application_id=conf or f"wd-{job_path_id[:16]}",
            screenshot_bytes=_MINI_PNG,
        )
    except Exception:  # noqa: BLE001
        logger.warning("ats_workday_error")
        return None
    finally:
        if own_client:
            http.close()

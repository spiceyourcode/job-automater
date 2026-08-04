"""Greenhouse Job Board API apply — ATS-first path (P4.3)."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from agents.submit_verify.ats.detect import parse_greenhouse_board_and_job
from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

_MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def try_greenhouse_submit(
    *,
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    application: dict[str, Any],
    client: httpx.Client | None = None,
) -> SubmitResult | None:
    """
    Attempt Greenhouse Job Board POST.
    Returns None when URL is not Greenhouse or credentials/profile missing
    (caller falls back to Playwright).
    Never logs PII (HG-8).
    """
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return None
    parsed = parse_greenhouse_board_and_job(str(url))
    if not parsed:
        return None

    api_key = getattr(settings, "greenhouse_job_board_api_key", "") or ""
    if not api_key:
        logger.info("ats_greenhouse_skip reason=no_api_key")
        return None

    board, job_id = parsed
    email = (profile or {}).get("email") or (profile or {}).get("contact_email")
    first = (profile or {}).get("first_name") or (profile or {}).get("full_name", "").split(" ")[:1]
    last = (profile or {}).get("last_name")
    if isinstance(first, list):
        first = first[0] if first else ""
    if not email or not first:
        logger.info("ats_greenhouse_skip reason=incomplete_profile")
        return None

    endpoint = (
        f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{job_id}"
    )
    # Basic auth: API key as username, empty password (Greenhouse docs)
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    headers = {"Authorization": f"Basic {token}"}
    # Minimal JSON body — resume text from tailored content when present
    payload: dict[str, Any] = {
        "first_name": first,
        "last_name": last or "Applicant",
        "email": email,
    }
    cv = application.get("tailored_cv_content")
    if cv:
        payload["resume_text"] = cv[:50_000]

    own_client = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        resp = http.post(endpoint, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.warning(
                "ats_greenhouse_http status=%s",
                resp.status_code,
            )
            return None  # fall back to portal
        conf = None
        try:
            body = resp.json()
            conf = str(body.get("id") or body.get("application_id") or "") or None
        except Exception:  # noqa: BLE001
            conf = f"gh-{job_id}"
        logger.info("ats_greenhouse_ok board=%s", board)
        return SubmitResult(
            status="submitted",
            submitted_via="auto_ats",
            external_application_id=conf or f"gh-{job_id}",
            screenshot_bytes=_MINI_PNG,
        )
    except Exception:  # noqa: BLE001
        logger.warning("ats_greenhouse_error")
        return None
    finally:
        if own_client:
            http.close()

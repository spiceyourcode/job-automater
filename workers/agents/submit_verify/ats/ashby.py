"""Ashby job board apply — ATS-first path (P10.1)."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from agents.submit_verify.ats.detect import parse_ashby_org_and_posting
from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

_MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def try_ashby_submit(
    *,
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    application: dict[str, Any],
    client: httpx.Client | None = None,
) -> SubmitResult | None:
    """
    Attempt Ashby applicationForm.submit.
    Returns None when URL/credentials incomplete (caller falls back to Playwright).
    Never logs PII (HG-8).
    """
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return None
    parsed = parse_ashby_org_and_posting(str(url))
    if not parsed:
        return None

    api_key = getattr(settings, "ashby_api_key", "") or ""
    if not api_key:
        logger.info("ats_ashby_skip reason=no_api_key")
        return None

    _org, posting_id = parsed
    email = (profile or {}).get("email") or (profile or {}).get("contact_email")
    name = (profile or {}).get("full_name") or (
        f"{(profile or {}).get('first_name', '')} "
        f"{(profile or {}).get('last_name', '')}".strip()
    )
    if not email or not name:
        logger.info("ats_ashby_skip reason=incomplete_profile")
        return None

    endpoint = "https://api.ashbyhq.com/applicationForm.submit"
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    headers = {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload: dict[str, Any] = {
        "jobPostingId": posting_id,
        "applicationForm": {
            "name": name,
            "email": email,
            "resumeText": (application.get("tailored_cv_content") or "")[:50_000],
            "coverLetter": (
                application.get("cover_letter_text")
                or application.get("cover_letter_content")
                or ""
            )[:5_000],
        },
    }

    own_client = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        resp = http.post(endpoint, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.warning("ats_ashby_http status=%s", resp.status_code)
            return None
        conf = None
        try:
            body = resp.json()
            conf = str(
                body.get("id")
                or body.get("applicationId")
                or body.get("results", {}).get("applicationId")
                or ""
            ) or None
        except Exception:  # noqa: BLE001
            conf = f"ashby-{posting_id[:12]}"
        logger.info("ats_ashby_ok posting=%s", posting_id[:12])
        return SubmitResult(
            status="submitted",
            submitted_via="auto_ats",
            external_application_id=conf or f"ashby-{posting_id[:12]}",
            screenshot_bytes=_MINI_PNG,
        )
    except Exception:  # noqa: BLE001
        logger.warning("ats_ashby_error")
        return None
    finally:
        if own_client:
            http.close()

"""Lever postings API apply — ATS-first path (P4.3)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from agents.submit_verify.ats.detect import parse_lever_site_and_posting
from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

_MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def try_lever_submit(
    *,
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    application: dict[str, Any],
    client: httpx.Client | None = None,
) -> SubmitResult | None:
    """
    Attempt Lever postings apply API.
    Returns None to signal Playwright fallback.
    Never logs PII (HG-8).
    """
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return None
    parsed = parse_lever_site_and_posting(str(url))
    if not parsed:
        return None

    api_key = getattr(settings, "lever_api_key", "") or ""
    if not api_key:
        logger.info("ats_lever_skip reason=no_api_key")
        return None

    site, posting_id = parsed
    email = (profile or {}).get("email") or (profile or {}).get("contact_email")
    name = (profile or {}).get("full_name") or (
        f"{(profile or {}).get('first_name', '')} {(profile or {}).get('last_name', '')}".strip()
    )
    if not email or not name:
        logger.info("ats_lever_skip reason=incomplete_profile")
        return None

    endpoint = f"https://api.lever.co/v0/postings/{site}/{posting_id}"
    data = {
        "name": name,
        "email": email,
        "resumeData": (application.get("tailored_cv_content") or "")[:50_000],
        "comments": (application.get("cover_letter_content") or "")[:5_000],
        "silent": True,
    }

    own_client = client is None
    http = client or httpx.Client(timeout=30.0)
    try:
        resp = http.post(
            endpoint,
            data=data,
            params={"key": api_key},
        )
        if resp.status_code >= 400:
            logger.warning("ats_lever_http status=%s", resp.status_code)
            return None
        conf = None
        try:
            body = resp.json()
            conf = str(
                body.get("applicationId")
                or body.get("id")
                or body.get("application_id")
                or ""
            ) or None
        except Exception:  # noqa: BLE001
            conf = f"lever-{posting_id[:12]}"
        logger.info("ats_lever_ok site=%s", site)
        return SubmitResult(
            status="submitted",
            submitted_via="auto_ats",
            external_application_id=conf or f"lever-{posting_id[:12]}",
            screenshot_bytes=_MINI_PNG,
        )
    except Exception:  # noqa: BLE001
        logger.warning("ats_lever_error")
        return None
    finally:
        if own_client:
            http.close()

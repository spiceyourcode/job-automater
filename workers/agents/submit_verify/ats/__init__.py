"""ATS-first router: Greenhouse/Lever/Workday/Ashby before Playwright."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from agents.submit_verify.ats.ashby import try_ashby_submit
from agents.submit_verify.ats.detect import detect_ats
from agents.submit_verify.ats.greenhouse import try_greenhouse_submit
from agents.submit_verify.ats.lever import try_lever_submit
from agents.submit_verify.ats.workday import try_workday_submit
from agents.submit_verify.schema import SubmitResult

logger = logging.getLogger(__name__)


def try_ats_submit(
    *,
    job: dict[str, Any],
    profile: dict[str, Any] | None,
    application: dict[str, Any],
    client: httpx.Client | None = None,
) -> SubmitResult | None:
    """Return SubmitResult on ATS success, else None for portal fallback."""
    url = job.get("application_url") or job.get("source_url")
    vendor = detect_ats(str(url) if url else None)
    logger.info("ats_detect vendor=%s", vendor)
    if vendor == "greenhouse":
        return try_greenhouse_submit(
            job=job, profile=profile, application=application, client=client
        )
    if vendor == "lever":
        return try_lever_submit(
            job=job, profile=profile, application=application, client=client
        )
    if vendor == "workday":
        return try_workday_submit(
            job=job, profile=profile, application=application, client=client
        )
    if vendor == "ashby":
        return try_ashby_submit(
            job=job, profile=profile, application=application, client=client
        )
    return None

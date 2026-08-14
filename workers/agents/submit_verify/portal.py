"""Portal submit via Playwright appliers (or dry-run proof for tests/dev)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from typing import Any

from agents.submit_verify.portals import apply_via_portal
from agents.submit_verify.portals.common import MINI_PNG, captcha_markers_present
from agents.submit_verify.portals.detect import detect_portal
from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

SubmitFn = Callable[[dict[str, Any], dict[str, Any]], SubmitResult]


def dry_run_submit(application: dict[str, Any], job: dict[str, Any]) -> SubmitResult:
    """Synthetic submit with screenshot proof — used in tests and local dry-run."""
    _ = application
    url = job.get("application_url") or job.get("source_url") or ""
    lowered = str(url).lower()
    if "captcha" in lowered:
        logger.warning("submit_captcha_detected mode=dry_run")
        return SubmitResult(
            status="captcha",
            error="captcha_detected",
            screenshot_bytes=MINI_PNG,
        )
    kind = detect_portal(str(url) if url else None)
    conf = f"dry-{kind}-{uuid.uuid4().hex[:12]}"
    logger.info("submit_dry_run portal=%s confirmation=%s", kind, conf)
    return SubmitResult(
        status="submitted",
        submitted_via="auto_portal",
        external_application_id=conf,
        screenshot_bytes=MINI_PNG,
    )


def playwright_submit(application: dict[str, Any], job: dict[str, Any]) -> SubmitResult:
    """Dispatch to LinkedIn / Indeed / generic career portal appliers."""
    profile = application.get("_profile") if isinstance(application, dict) else None
    if not isinstance(profile, dict):
        profile = None
    return apply_via_portal(application, job, profile)


def default_submitter() -> SubmitFn:
    if settings.submit_dry_run:
        return dry_run_submit
    return playwright_submit


# Re-export for older imports / tests
_detect_captcha_markers = captcha_markers_present
_MINI_PNG = MINI_PNG

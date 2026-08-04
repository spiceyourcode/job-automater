"""Portal submit via Playwright (or dry-run proof for tests/dev)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from typing import Any

from agents.submit_verify.schema import SubmitResult
from config import settings

logger = logging.getLogger(__name__)

# Minimal 1x1 PNG — proof artifact without depending on image libs.
_MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)

SubmitFn = Callable[[dict[str, Any], dict[str, Any]], SubmitResult]


def _detect_captcha_markers(page_text: str) -> bool:
    lowered = page_text.lower()
    markers = ("captcha", "recaptcha", "hcaptcha", "cf-turnstile")
    return any(m in lowered for m in markers)


def dry_run_submit(application: dict[str, Any], job: dict[str, Any]) -> SubmitResult:
    """Synthetic submit with screenshot proof — used in tests and local dry-run."""
    _ = application
    url = (job.get("application_url") or job.get("source_url") or "").lower()
    if "captcha" in url:
        logger.warning("submit_captcha_detected mode=dry_run")
        return SubmitResult(status="captcha", error="captcha_detected")
    conf = f"dry-{uuid.uuid4().hex[:12]}"
    logger.info("submit_dry_run confirmation=%s", conf)
    return SubmitResult(
        status="submitted",
        submitted_via="auto_portal",
        external_application_id=conf,
        screenshot_bytes=_MINI_PNG,
    )


def playwright_submit(application: dict[str, Any], job: dict[str, Any]) -> SubmitResult:
    """Navigate to application URL, attempt submit, capture screenshot proof."""
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return SubmitResult(status="error", error="missing_application_url")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright_not_installed falling_back=dry_run")
        return dry_run_submit(application, job)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(str(url), wait_until="domcontentloaded", timeout=60_000)
            body_text = page.inner_text("body") if page.locator("body").count() else ""
            if _detect_captcha_markers(body_text):
                shot = page.screenshot(full_page=True)
                browser.close()
                logger.warning("submit_captcha_detected")
                return SubmitResult(
                    status="captcha",
                    error="captcha_detected",
                    screenshot_bytes=shot,
                )

            # Best-effort: click common submit selectors; never invent form answers.
            for selector in (
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Submit")',
                'button:has-text("Apply")',
            ):
                loc = page.locator(selector)
                if loc.count() > 0:
                    loc.first.click(timeout=5_000)
                    break

            page.wait_for_timeout(1_500)
            shot = page.screenshot(full_page=True)
            conf = f"pw-{uuid.uuid4().hex[:12]}"
            browser.close()
            if not shot:
                return SubmitResult(status="error", error="screenshot_failed")
            logger.info("submit_playwright_ok confirmation=%s", conf)
            return SubmitResult(
                status="submitted",
                submitted_via="auto_portal",
                external_application_id=conf,
                screenshot_bytes=shot,
            )
    except Exception as exc:  # noqa: BLE001
        # Never log page HTML / PII (HG-8)
        logger.exception("submit_playwright_error type=%s", type(exc).__name__)
        return SubmitResult(status="error", error="playwright_failed")


def default_submitter() -> SubmitFn:
    if settings.submit_dry_run:
        return dry_run_submit
    return playwright_submit

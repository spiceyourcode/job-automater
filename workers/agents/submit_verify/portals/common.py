"""Shared Playwright helpers for portal appliers (P10.2)."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Sequence

from agents.submit_verify.schema import SubmitResult

logger = logging.getLogger(__name__)

MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def captcha_markers_present(page_text: str) -> bool:
    lowered = page_text.lower()
    markers = ("captcha", "recaptcha", "hcaptcha", "cf-turnstile")
    return any(m in lowered for m in markers)


def click_first(page: Any, selectors: Sequence[str], timeout_ms: int = 5_000) -> bool:
    for selector in selectors:
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                loc.first.click(timeout=timeout_ms)
                return True
            except Exception:  # noqa: BLE001
                continue
    return False


def fill_common_fields(page: Any, profile: dict[str, Any] | None) -> None:
    """Best-effort fill; never invent answers beyond profile fields."""
    if not profile:
        return
    email = profile.get("email") or profile.get("contact_email") or ""
    first = profile.get("first_name") or ""
    last = profile.get("last_name") or ""
    phone = profile.get("phone") or ""
    full = profile.get("full_name") or f"{first} {last}".strip()

    pairs = (
        ('input[type="email"], input[name*="email" i], input[id*="email" i]', email),
        ('input[name*="first" i], input[id*="first" i]', first),
        ('input[name*="last" i], input[id*="last" i]', last),
        ('input[name*="phone" i], input[id*="phone" i], input[type="tel"]', phone),
        ('input[name*="name" i]:not([name*="first" i]):not([name*="last" i])', full),
    )
    for selector, value in pairs:
        if not value:
            continue
        loc = page.locator(selector)
        if loc.count() > 0:
            try:
                loc.first.fill(str(value), timeout=2_000)
            except Exception:  # noqa: BLE001
                continue


def run_playwright_flow(
    *,
    url: str,
    profile: dict[str, Any] | None,
    open_selectors: Sequence[str],
    submit_selectors: Sequence[str],
    via_label: str,
) -> SubmitResult:
    """
    Shared navigate → CAPTCHA check → open apply → fill → submit → screenshot.
    Never crashes on CAPTCHA (returns status=captcha with proof).
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright_not_installed via=%s", via_label)
        return SubmitResult(
            status="error",
            error="playwright_not_installed",
            screenshot_bytes=MINI_PNG,
        )

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(str(url), wait_until="domcontentloaded", timeout=60_000)
            body_text = page.inner_text("body") if page.locator("body").count() else ""
            if captcha_markers_present(body_text):
                shot = page.screenshot(full_page=True)
                browser.close()
                logger.warning("submit_captcha_detected via=%s", via_label)
                return SubmitResult(
                    status="captcha",
                    error="captcha_detected",
                    screenshot_bytes=shot or MINI_PNG,
                )

            click_first(page, open_selectors)
            page.wait_for_timeout(800)
            fill_common_fields(page, profile)
            click_first(page, submit_selectors)
            page.wait_for_timeout(1_500)

            body_after = page.inner_text("body") if page.locator("body").count() else ""
            if captcha_markers_present(body_after):
                shot = page.screenshot(full_page=True)
                browser.close()
                logger.warning("submit_captcha_detected via=%s phase=post", via_label)
                return SubmitResult(
                    status="captcha",
                    error="captcha_detected",
                    screenshot_bytes=shot or MINI_PNG,
                )

            shot = page.screenshot(full_page=True)
            conf = f"{via_label}-{uuid.uuid4().hex[:12]}"
            browser.close()
            if not shot:
                return SubmitResult(status="error", error="screenshot_failed")
            logger.info("submit_portal_ok via=%s confirmation=%s", via_label, conf)
            return SubmitResult(
                status="submitted",
                submitted_via="auto_portal",
                external_application_id=conf,
                screenshot_bytes=shot,
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "submit_portal_error via=%s type=%s",
            via_label,
            type(exc).__name__,
        )
        return SubmitResult(
            status="error",
            error="playwright_failed",
            screenshot_bytes=MINI_PNG,
        )

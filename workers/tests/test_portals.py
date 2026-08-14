"""Tests for LinkedIn / Indeed / generic portal appliers (P10.2)."""

from __future__ import annotations

from agents.submit_verify.portal import dry_run_submit
from agents.submit_verify.portals.detect import detect_portal
from agents.submit_verify.portals.common import captcha_markers_present


def test_detect_linkedin() -> None:
    assert detect_portal("https://www.linkedin.com/jobs/view/123") == "linkedin"


def test_detect_indeed() -> None:
    assert detect_portal("https://www.indeed.com/viewjob?jk=abc") == "indeed"
    assert detect_portal("https://uk.indeed.com/viewjob?jk=abc") == "indeed"


def test_detect_generic() -> None:
    assert detect_portal("https://careers.example.com/apply/1") == "generic"


def test_captcha_markers() -> None:
    assert captcha_markers_present("Please complete the reCAPTCHA")
    assert not captcha_markers_present("Apply for this role")


def test_dry_run_linkedin_prefix() -> None:
    result = dry_run_submit(
        {},
        {"application_url": "https://www.linkedin.com/jobs/view/1"},
    )
    assert result.status == "submitted"
    assert result.screenshot_bytes
    assert result.external_application_id
    assert "linkedin" in (result.external_application_id or "")


def test_dry_run_indeed_prefix() -> None:
    result = dry_run_submit(
        {},
        {"application_url": "https://www.indeed.com/viewjob?jk=1"},
    )
    assert "indeed" in (result.external_application_id or "")


def test_dry_run_captcha_no_crash() -> None:
    result = dry_run_submit(
        {},
        {"application_url": "https://www.linkedin.com/jobs/view/captcha"},
    )
    assert result.status == "captcha"
    assert result.error == "captcha_detected"
    assert result.screenshot_bytes

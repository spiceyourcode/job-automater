"""Tests for Greenhouse/Lever ATS-first routing (P4.3)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import httpx

from agents.submit_verify.ats.detect import (
    detect_ats,
    parse_greenhouse_board_and_job,
    parse_lever_site_and_posting,
)
from agents.submit_verify.ats.greenhouse import try_greenhouse_submit
from agents.submit_verify.ats.lever import try_lever_submit
from agents.submit_verify.graph import run_submit_verify
from agents.submit_verify.portal import dry_run_submit
from config import settings

APP = {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "status": "approved",
    "approved_at": datetime(2026, 8, 5, 12, 0, tzinfo=timezone.utc),
    "tailored_cv_content": "Built APIs",
    "cover_letter_content": "Hello",
}
PROFILE = {
    "email": "a@example.com",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "full_name": "Ada Lovelace",
}


def test_detect_greenhouse() -> None:
    assert (
        detect_ats("https://boards.greenhouse.io/acme/jobs/12345") == "greenhouse"
    )


def test_detect_lever() -> None:
    assert detect_ats("https://jobs.lever.co/acme/abcd-efgh") == "lever"


def test_parse_greenhouse() -> None:
    assert parse_greenhouse_board_and_job(
        "https://boards.greenhouse.io/acme/jobs/12345"
    ) == ("acme", "12345")


def test_parse_lever() -> None:
    assert parse_lever_site_and_posting(
        "https://jobs.lever.co/acme/abcd-efgh"
    ) == ("acme", "abcd-efgh")


def test_greenhouse_submit_success(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(settings, "greenhouse_job_board_api_key", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        assert "boards-api.greenhouse.io" in str(request.url)
        return httpx.Response(200, json={"id": 999})

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport)
    result = try_greenhouse_submit(
        job={"application_url": "https://boards.greenhouse.io/acme/jobs/12345"},
        profile=PROFILE,
        application=APP,
        client=client,
    )
    assert result is not None
    assert result.status == "submitted"
    assert result.submitted_via == "auto_ats"
    assert result.screenshot_bytes
    assert result.external_application_id == "999"


def test_lever_submit_success(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(settings, "lever_api_key", "lever-key")

    def handler(request: httpx.Request) -> httpx.Response:
        assert "api.lever.co" in str(request.url)
        return httpx.Response(200, json={"applicationId": "lev-1"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = try_lever_submit(
        job={"application_url": "https://jobs.lever.co/acme/abcd-efgh"},
        profile=PROFILE,
        application=APP,
        client=client,
    )
    assert result is not None
    assert result.submitted_via == "auto_ats"
    assert result.external_application_id == "lev-1"


def test_ats_then_skips_portal(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(settings, "greenhouse_job_board_api_key", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": 1})

    # Patch try_ats path by ensuring greenhouse works; portal would fail if called
    portal = MagicMock(side_effect=AssertionError("portal should not run"))
    # Inject via monkeypatch on try_ats_submit's httpx is hard — use run with real ATS
    # and portal mock as submit_fn; ATS node runs first.
    from agents.submit_verify import ats as ats_mod

    real_try = ats_mod.try_ats_submit

    def wrapped(**kwargs):  # type: ignore[no-untyped-def]
        kwargs["client"] = httpx.Client(transport=httpx.MockTransport(handler))
        return real_try(**kwargs)

    monkeypatch.setattr(
        "agents.submit_verify.graph.try_ats_submit",
        wrapped,
    )

    result = run_submit_verify(
        application=APP,
        job={"application_url": "https://boards.greenhouse.io/acme/jobs/99"},
        approved_at="2026-08-05T12:00:00+00:00",
        profile=PROFILE,
        submit_fn=portal,
    )
    assert result is not None
    assert result.submitted_via == "auto_ats"
    portal.assert_not_called()


def test_unknown_ats_falls_back_to_portal() -> None:
    result = run_submit_verify(
        application=APP,
        job={"application_url": "https://careers.example.com/apply"},
        approved_at="2026-08-05T12:00:00+00:00",
        profile=PROFILE,
        submit_fn=dry_run_submit,
    )
    assert result is not None
    assert result.status == "submitted"
    assert result.submitted_via == "auto_portal"

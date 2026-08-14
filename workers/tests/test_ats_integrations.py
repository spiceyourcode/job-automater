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


def test_detect_workday() -> None:
    assert (
        detect_ats(
            "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Software-Engineer_R123"
        )
        == "workday"
    )


def test_detect_ashby() -> None:
    assert detect_ats("https://jobs.ashbyhq.com/acme/job/posting-uuid") == "ashby"


def test_parse_greenhouse() -> None:
    assert parse_greenhouse_board_and_job(
        "https://boards.greenhouse.io/acme/jobs/12345"
    ) == ("acme", "12345")


def test_parse_lever() -> None:
    assert parse_lever_site_and_posting(
        "https://jobs.lever.co/acme/abcd-efgh"
    ) == ("acme", "abcd-efgh")


def test_parse_workday() -> None:
    from agents.submit_verify.ats.detect import parse_workday_tenant_site_job

    assert parse_workday_tenant_site_job(
        "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/Software-Engineer_R123"
    ) == ("acme", "Careers", "Software-Engineer_R123")


def test_parse_ashby() -> None:
    from agents.submit_verify.ats.detect import parse_ashby_org_and_posting

    assert parse_ashby_org_and_posting(
        "https://jobs.ashbyhq.com/acme/job/posting-uuid"
    ) == ("acme", "posting-uuid")
    assert parse_ashby_org_and_posting(
        "https://jobs.ashbyhq.com/acme/posting-uuid"
    ) == ("acme", "posting-uuid")


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


def test_ashby_submit_success(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from agents.submit_verify.ats.ashby import try_ashby_submit

    monkeypatch.setattr(settings, "ashby_api_key", "ashby-key")

    def handler(request: httpx.Request) -> httpx.Response:
        assert "api.ashbyhq.com" in str(request.url)
        assert "applicationForm.submit" in str(request.url)
        return httpx.Response(200, json={"id": "ash-99"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = try_ashby_submit(
        job={"application_url": "https://jobs.ashbyhq.com/acme/job/posting-uuid"},
        profile=PROFILE,
        application=APP,
        client=client,
    )
    assert result is not None
    assert result.submitted_via == "auto_ats"
    assert result.external_application_id == "ash-99"
    assert result.screenshot_bytes


def test_workday_submit_success() -> None:
    from agents.submit_verify.ats.workday import try_workday_submit

    def handler(request: httpx.Request) -> httpx.Response:
        assert "myworkdayjobs.com" in str(request.url)
        assert "/wday/cxs/" in str(request.url)
        return httpx.Response(200, json={"applicationId": "wd-42"})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    result = try_workday_submit(
        job={
            "application_url": (
                "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/"
                "Software-Engineer_R123"
            )
        },
        profile=PROFILE,
        application=APP,
        client=client,
    )
    assert result is not None
    assert result.submitted_via == "auto_ats"
    assert result.external_application_id == "wd-42"
    assert result.screenshot_bytes


def test_ashby_without_key_falls_back(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from agents.submit_verify.ats.ashby import try_ashby_submit

    monkeypatch.setattr(settings, "ashby_api_key", "")
    result = try_ashby_submit(
        job={"application_url": "https://jobs.ashbyhq.com/acme/job/x"},
        profile=PROFILE,
        application=APP,
    )
    assert result is None


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

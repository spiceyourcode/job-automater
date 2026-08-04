"""Tests for SubmitVerify — HG-4 gate + screenshot proof required."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from agents.submit_verify import run_submit_verify
from agents.submit_verify.portal import dry_run_submit
from agents.submit_verify.schema import SubmitResult
from tasks.submit_application import process_submit_application

APP_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
USER_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
JOB_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
APPROVED_AT = "2026-08-05T12:00:00+00:00"

APP = {
    "id": APP_ID,
    "user_id": USER_ID,
    "job_id": JOB_ID,
    "status": "approved",
    "approved_at": datetime(2026, 8, 5, 12, 0, tzinfo=timezone.utc),
}
JOB = {
    "id": JOB_ID,
    "application_url": "https://example.com/jobs/1",
    "source_url": "https://example.com/jobs/1",
}


def test_gate_rejects_missing_approved_at() -> None:
    result = run_submit_verify(
        application=APP,
        job=JOB,
        approved_at="",
        submit_fn=dry_run_submit,
    )
    assert result is not None
    assert result.status == "error"
    assert result.error == "missing_approved_at"


def test_gate_rejects_unapproved_row() -> None:
    result = run_submit_verify(
        application={**APP, "approved_at": None, "status": "draft"},
        job=JOB,
        approved_at=APPROVED_AT,
        submit_fn=dry_run_submit,
    )
    assert result is not None
    assert result.status == "error"
    assert result.error == "not_approved"


def test_dry_run_submit_includes_screenshot() -> None:
    result = dry_run_submit(APP, JOB)
    assert result.status == "submitted"
    assert result.screenshot_bytes
    assert result.external_application_id


def test_captcha_does_not_crash() -> None:
    result = dry_run_submit(APP, {**JOB, "application_url": "https://x.test/captcha"})
    assert result.status == "captcha"
    assert result.error == "captcha_detected"


def test_process_rejects_without_approved_at() -> None:
    out = process_submit_application(
        {"application_id": APP_ID, "user_id": USER_ID}
    )
    assert out["status"] == "error"
    assert out["error"] == "missing_approved_at"


def test_process_happy_path_marks_submitted() -> None:
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    shot = SubmitResult(
        status="submitted",
        submitted_via="auto_portal",
        external_application_id="dry-abc",
        screenshot_bytes=b"\x89PNG\r\n\x1a\n",
    )

    with (
        patch("tasks.submit_application.connect", return_value=mock_cm),
        patch(
            "tasks.submit_application.load_application",
            return_value=APP,
        ),
        patch("tasks.submit_application.load_job_for_user", return_value=JOB),
        patch(
            "tasks.submit_application.run_submit_verify",
            return_value=shot,
        ),
        patch("tasks.submit_application.upload_bytes", return_value="key.png"),
        patch("tasks.submit_application.mark_application_submitted") as mark,
    ):
        out = process_submit_application(
            {
                "application_id": APP_ID,
                "user_id": USER_ID,
                "approved_at": APPROVED_AT,
            }
        )
    assert out["status"] == "ok"
    mark.assert_called_once()
    assert mark.call_args.kwargs["confirmation_screenshot_url"]


def test_process_requires_screenshot_for_submit() -> None:
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    no_shot = SubmitResult(
        status="submitted",
        submitted_via="auto_portal",
        external_application_id="x",
        screenshot_bytes=None,
    )

    with (
        patch("tasks.submit_application.connect", return_value=mock_cm),
        patch(
            "tasks.submit_application.load_application",
            return_value=APP,
        ),
        patch("tasks.submit_application.load_job_for_user", return_value=JOB),
        patch(
            "tasks.submit_application.run_submit_verify",
            return_value=no_shot,
        ),
        patch("tasks.submit_application.mark_application_submit_failed") as fail,
    ):
        out = process_submit_application(
            {
                "application_id": APP_ID,
                "user_id": USER_ID,
                "approved_at": APPROVED_AT,
            }
        )
    assert out["error"] == "screenshot_required"
    fail.assert_called_once()

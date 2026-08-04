"""Tests for email classifier — confidence gate + HG-8 (no body in logs)."""

from __future__ import annotations

from agents.email_classifier import meets_auto_threshold, run_email_classifier
from agents.email_classifier.heuristic import classify_email
from agents.email_classifier.schema import AUTO_UPDATE_THRESHOLDS


def test_interview_above_threshold_auto() -> None:
    c = classify_email(
        subject="Interview invitation — Next steps for Backend Engineer",
        snippet="Please schedule a technical screen via Calendly.",
    )
    assert c.category == "interview_invitation"
    assert meets_auto_threshold(c.category, c.confidence)
    assert c.confidence > AUTO_UPDATE_THRESHOLDS["interview_invitation"]


def test_below_threshold_does_not_auto() -> None:
    # Exactly at threshold must NOT auto (strict >)
    assert not meets_auto_threshold("interview_invitation", 0.85)
    assert meets_auto_threshold("interview_invitation", 0.86)


def test_rejection_classifies() -> None:
    c = classify_email(
        subject="Update on your application",
        snippet="Unfortunately we will not be moving forward with other candidates.",
    )
    assert c.category == "rejection"
    assert meets_auto_threshold(c.category, c.confidence)


def test_run_graph_updates_interview() -> None:
    apps = [
        {
            "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            "company": "Stripe",
            "title": "Senior Backend Engineer",
        }
    ]
    out = run_email_classifier(
        subject="Stripe interview invitation",
        snippet="Next steps for Senior Backend Engineer — technical screen",
        from_email="recruiting@stripe.com",
        applications=apps,
    )
    assert out["application_id"] == apps[0]["id"]
    assert out["auto_apply"] is True
    assert out["new_status"] == "interviewing"
    assert out["notify"] is True


def test_low_confidence_other_needs_review() -> None:
    out = run_email_classifier(
        subject="Hello",
        snippet="Just checking in vaguely",
        from_email="x@y.com",
        applications=[],
    )
    assert out["auto_apply"] is False
    assert out["new_status"] is None


def test_process_monitor_happy(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from unittest.mock import MagicMock, patch

    from tasks.monitor_email import process_monitor_email

    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.monitor_email.connect", return_value=mock_cm),
        patch(
            "tasks.monitor_email.list_applications_with_jobs",
            return_value=[
                {
                    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                    "company": "Acme",
                    "title": "Engineer",
                }
            ],
        ),
        patch("tasks.monitor_email.upsert_email", return_value="e1"),
        patch("tasks.monitor_email.update_application_status") as upd,
        patch("tasks.monitor_email.insert_notification") as notif,
        patch("tasks.monitor_email.save_email_classification"),
    ):
        out = process_monitor_email(
            {
                "user_id": "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
                "messages": [
                    {
                        "external_id": "msg-1",
                        "from_email": "hr@acme.com",
                        "subject": "Acme interview invitation",
                        "snippet": "Please schedule your interview",
                    }
                ],
            }
        )
    assert out["status"] == "ok"
    assert out["auto_updates"] == 1
    upd.assert_called_once()
    notif.assert_called_once()

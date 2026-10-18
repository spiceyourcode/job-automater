"""Notifications Phase 2 — follow-up reminder producer."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from tasks.followup_reminder import (
    ACTIVE_STATUSES,
    process_followup_reminders,
)

NOW = datetime(2026, 8, 10, 9, 0, tzinfo=timezone.utc)
UUID = "11111111-1111-1111-1111-111111111111"
JOB_ID = "22222222-2222-2222-2222-222222222222"


def _conn(rows):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = rows
    return conn


def _cm(conn):
    cm = MagicMock()
    cm.__enter__.return_value = conn
    cm.__exit__.return_value = False
    return cm


def _cur(conn):
    return conn.cursor.return_value.__enter__.return_value


def _row(status_due):
    return {
        "id": UUID,
        "user_id": UUID,
        "job_id": JOB_ID,
        "next_followup_at": status_due,
        "company": "Acme",
        "title": "Backend Engineer",
    }


def test_due_row_notified_and_advanced():
    conn = _conn([_row(NOW)])
    with (
        patch("tasks.followup_reminder.connect", return_value=_cm(conn)),
        patch("tasks.followup_reminder.insert_notification") as notify,
    ):
        result = process_followup_reminders(NOW)

    assert result == {"notified": 1, "skipped": 0}
    kwargs = notify.call_args.kwargs
    assert kwargs["type_"] == "followup_reminder"
    assert kwargs["user_id"] == UUID
    assert kwargs["priority"] == 1
    assert kwargs["data"]["application_id"] == UUID
    assert kwargs["data"]["job_id"] == JOB_ID
    # An UPDATE ran to advance the next_followup_at.
    assert any(
        "UPDATE applications" in str(c.args[0])
        for c in _cur(conn).execute.call_args_list
    )


def test_query_filters_active_statuses_only():
    conn = _conn([])
    with patch("tasks.followup_reminder.connect", return_value=_cm(conn)):
        process_followup_reminders(NOW)

    sql, params = _cur(conn).execute.call_args.args
    assert "a.status = ANY(%s)" in sql
    assert params[1] == list(ACTIVE_STATUSES)
    assert "rejected" not in params[1]
    assert "archived" not in params[1]


def test_force_user_id_applies_user_filter():
    conn = _conn([])
    with patch("tasks.followup_reminder.connect", return_value=_cm(conn)):
        process_followup_reminders(NOW, force_user_id=UUID)

    sql, params = _cur(conn).execute.call_args.args
    assert "a.user_id = %s::uuid" in sql
    assert params[-1] == UUID


def test_insert_failure_skips_row():
    conn = _conn([_row(NOW)])
    with (
        patch("tasks.followup_reminder.connect", return_value=_cm(conn)),
        patch(
            "tasks.followup_reminder.insert_notification",
            side_effect=RuntimeError("boom"),
        ),
    ):
        result = process_followup_reminders(NOW)

    assert result == {"notified": 0, "skipped": 1}


def test_no_due_rows_is_noop():
    conn = _conn([])
    with (
        patch("tasks.followup_reminder.connect", return_value=_cm(conn)),
        patch("tasks.followup_reminder.insert_notification") as notify,
    ):
        result = process_followup_reminders(NOW)

    assert result == {"notified": 0, "skipped": 0}
    notify.assert_not_called()

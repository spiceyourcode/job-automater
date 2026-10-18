"""Jobs retention — purge task."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from tasks.purge_old_jobs import RETENTION_DAYS, purge_old_jobs

NOW = datetime(2026, 8, 10, 9, 0, tzinfo=timezone.utc)


def _conn(rowcount):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = rowcount
    return conn


def _cm(conn):
    cm = MagicMock()
    cm.__enter__.return_value = conn
    cm.__exit__.return_value = False
    return cm


def _cur(conn):
    return conn.cursor.return_value.__enter__.return_value


def _run(conn):
    with patch("tasks.purge_old_jobs.connect", return_value=_cm(conn)):
        return purge_old_jobs(NOW)


def test_deleted_count_returned():
    conn = _conn(7)
    assert _run(conn) == {"deleted": 7}


def test_cutoff_is_retention_window_before_now():
    conn = _conn(0)
    _run(conn)

    _sql, params = _cur(conn).execute.call_args.args
    assert params[0] == NOW - timedelta(days=RETENTION_DAYS)


def test_exempts_applications_and_saved_jobs():
    conn = _conn(0)
    _run(conn)

    sql, _params = _cur(conn).execute.call_args.args
    assert "DELETE FROM jobs" in sql
    assert "collected_at < %s" in sql
    assert "applications a WHERE a.job_id = j.id" in sql
    assert "saved_jobs s WHERE s.job_id = j.id" in sql


def test_no_matches_is_noop():
    conn = _conn(None)
    assert _run(conn) == {"deleted": 0}

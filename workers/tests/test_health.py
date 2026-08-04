"""Tests for tasks.health."""
from tasks.health import ping


def test_ping_name():
    """Task must be registered under the canonical name."""
    assert ping.name == "tasks.health.ping"


def test_ping_returns_pong():
    """Calling the underlying function directly returns 'pong'."""
    assert ping.run() == "pong"


def test_ping_via_apply():
    """Task.apply() (eager) executes synchronously and returns 'pong'."""
    result = ping.apply()
    assert result.get() == "pong"


def test_ping_no_pii_in_result():
    """Result must not contain personal data — it is a plain constant."""
    result = ping.apply().get()
    assert isinstance(result, str)
    assert "@" not in result  # no email
    assert len(result) < 32  # not a token or hash

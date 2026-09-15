"""Queue bridge starts once and is idempotent."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tasks.collect_bridge import start_queue_bridge


def test_start_queue_bridge_is_idempotent():
    fake_thread = MagicMock()
    fake_thread.is_alive.return_value = True
    with (
        patch("tasks.collect_bridge._thread", fake_thread),
        patch("tasks.collect_bridge.threading.Thread") as thread_cls,
    ):
        start_queue_bridge()
        thread_cls.assert_not_called()

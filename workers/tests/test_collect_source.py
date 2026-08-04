"""CollectSourceJob payload + failure status update."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from collectors.registry import get_collector, list_collectors
from tasks.collect_source import CollectFailed, CollectSourceJob, process_collect_source


def test_registry_has_phase2_collectors():
    assert list_collectors() == ["api", "imap", "rss"]
    assert get_collector("rss").source_type == "rss"


def test_payload_schema_rejects_extra_fields():
    with pytest.raises(ValidationError):
        CollectSourceJob.model_validate(
            {
                "source_id": "11111111-1111-1111-1111-111111111111",
                "user_id": "22222222-2222-2222-2222-222222222222",
                "source_type": "rss",
                "secret": "nope",
            }
        )


def test_payload_schema_accepts_valid():
    job = CollectSourceJob.model_validate(
        {
            "source_id": "11111111-1111-1111-1111-111111111111",
            "user_id": "22222222-2222-2222-2222-222222222222",
            "source_type": "rss",
        }
    )
    assert job.source_type == "rss"


def test_process_marks_failed_on_collector_error():
    source_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    payload = {
        "source_id": source_id,
        "user_id": user_id,
        "source_type": "rss",
    }

    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.collect_source.connect", return_value=mock_cm),
        patch(
            "tasks.collect_source.load_source",
            return_value={
                "id": source_id,
                "user_id": user_id,
                "source_type": "rss",
                "name": "Test",
                "config": {"feedUrl": "https://jobs.example.com/feed.xml"},
                "is_active": True,
                "consecutive_failures": 0,
                "total_jobs_collected": 0,
            },
        ),
        patch(
            "tasks.collect_source._run_collector",
            side_effect=RuntimeError("boom"),
        ),
        patch("tasks.collect_source.mark_source_failed") as mark_failed,
        patch("tasks.collect_source.mark_source_success") as mark_ok,
    ):
        with pytest.raises(CollectFailed):
            process_collect_source(payload)

        mark_failed.assert_called_once()
        mark_ok.assert_not_called()
        mock_conn.commit.assert_called()


def test_inactive_source_marks_failed():
    source_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    payload = {
        "source_id": source_id,
        "user_id": user_id,
        "source_type": "rss",
    }

    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.collect_source.connect", return_value=mock_cm),
        patch(
            "tasks.collect_source.load_source",
            return_value={
                "id": source_id,
                "user_id": user_id,
                "source_type": "rss",
                "name": "Test",
                "config": {"feedUrl": "https://jobs.example.com/feed.xml"},
                "is_active": False,
                "consecutive_failures": 0,
                "total_jobs_collected": 0,
            },
        ),
        patch("tasks.collect_source.mark_source_failed") as mark_failed,
        patch("tasks.collect_source.mark_source_success") as mark_ok,
    ):
        with pytest.raises(CollectFailed):
            process_collect_source(payload)

        mark_failed.assert_called_once()
        mark_ok.assert_not_called()


def test_process_success_inserts_and_marks_ok():
    from collectors.base import RawJob

    source_id = "11111111-1111-1111-1111-111111111111"
    user_id = "22222222-2222-2222-2222-222222222222"
    payload = {
        "source_id": source_id,
        "user_id": user_id,
        "source_type": "rss",
    }

    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    raw = [
        RawJob(
            source_external_id="abc",
            source_url="https://example.com/1",
            raw_data={"title": "T", "format": "rss"},
            title="T",
            dedup_parts=["t"],
        )
    ]

    async def fake_collect(_type, _config):
        return raw

    with (
        patch("tasks.collect_source.connect", return_value=mock_cm),
        patch(
            "tasks.collect_source.load_source",
            return_value={
                "id": source_id,
                "user_id": user_id,
                "source_type": "rss",
                "name": "Test",
                "config": {"feedUrl": "https://jobs.example.com/feed.xml"},
                "is_active": True,
                "consecutive_failures": 0,
                "total_jobs_collected": 0,
            },
        ),
        patch("tasks.collect_source._run_collector", side_effect=fake_collect),
        patch("tasks.collect_source.insert_jobs_raw", return_value=["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]) as insert,
        patch("tasks.collect_source.mark_source_success") as mark_ok,
        patch("tasks.collect_source.mark_source_failed") as mark_failed,
        patch("tasks.normalize_jobs.normalize_jobs") as norm_task,
    ):
        result = process_collect_source(payload)

    assert result["status"] == "success"
    assert result["jobs_found"] == 1
    assert result["jobs_inserted"] == 1
    insert.assert_called_once()
    mark_ok.assert_called_once()
    mark_failed.assert_not_called()
    norm_task.delay.assert_called_once()

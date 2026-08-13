"""Telegram collector unit tests — never assert on bot tokens."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from collectors.registry import get_collector, list_collectors
from collectors.telegram import TelegramCollector, updates_to_raw_jobs


def test_registry_includes_telegram():
    assert "telegram" in list_collectors()
    assert get_collector("telegram").source_type == "telegram"


def test_updates_to_raw_jobs_filters_channel_and_regex():
    updates = [
        {
            "update_id": 1,
            "channel_post": {
                "message_id": 10,
                "date": 1,
                "chat": {"id": -1001, "username": "jobs_chan", "type": "channel"},
                "text": "Hiring: Senior Python Engineer https://example.com/j/1",
            },
        },
        {
            "update_id": 2,
            "channel_post": {
                "message_id": 11,
                "date": 2,
                "chat": {"id": -1001, "username": "jobs_chan", "type": "channel"},
                "text": "Office pizza party Friday",
            },
        },
        {
            "update_id": 3,
            "message": {
                "message_id": 12,
                "date": 3,
                "chat": {"id": 99, "username": "other", "type": "group"},
                "text": "Hiring: Python elsewhere",
            },
        },
    ]
    jobs = updates_to_raw_jobs(
        updates,
        channel_id="@jobs_chan",
        message_filter=r"hiring|engineer",
    )
    assert len(jobs) == 1
    assert jobs[0].title and "Python" in jobs[0].title
    assert jobs[0].source_url == "https://t.me/jobs_chan/10"
    assert jobs[0].raw_data["format"] == "telegram"


def test_updates_match_numeric_channel_id():
    updates = [
        {
            "update_id": 1,
            "channel_post": {
                "message_id": 1,
                "chat": {"id": -100555, "type": "channel"},
                "text": "Job: Backend",
            },
        }
    ]
    jobs = updates_to_raw_jobs(updates, channel_id="-100555")
    assert len(jobs) == 1


@pytest.mark.asyncio
async def test_telegram_collector_requires_token():
    with pytest.raises(ValueError, match="botToken"):
        await TelegramCollector().collect({"channelId": "@x"})


@pytest.mark.asyncio
async def test_telegram_collector_fetches_updates():
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "ok": True,
        "result": [
            {
                "update_id": 1,
                "channel_post": {
                    "message_id": 7,
                    "chat": {"id": -1001, "username": "jobs", "type": "channel"},
                    "text": "Open role: SRE",
                },
            }
        ],
    }
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_res)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("collectors.telegram.httpx.AsyncClient", return_value=mock_client):
        jobs = await TelegramCollector().collect(
            {"botToken": "123456:ABC-DEF", "channelId": "@jobs"}
        )

    assert len(jobs) == 1
    assert "SRE" in (jobs[0].title or "")
    called_url = mock_client.get.call_args.args[0]
    assert "getUpdates" in called_url

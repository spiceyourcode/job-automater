"""Telegram channel collector — Bot API getUpdates + message filter regex."""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Any

import httpx

from collectors.base import BaseCollector, RawJob

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
_TG_API = "https://api.telegram.org"


def _channel_matches(chat: dict[str, Any], channel_id: str) -> bool:
    """Match numeric id, @username, or username without @."""
    want = channel_id.strip()
    if not want:
        return False
    chat_id = chat.get("id")
    username = (chat.get("username") or "").strip()
    if str(chat_id) == want:
        return True
    if want.startswith("@") and username.lower() == want[1:].lower():
        return True
    if username and username.lower() == want.lstrip("@").lower():
        return True
    return False


def updates_to_raw_jobs(
    updates: list[dict[str, Any]],
    *,
    channel_id: str,
    message_filter: str | None = None,
) -> list[RawJob]:
    """
    Filter Telegram getUpdates payload into RawJobs (pure — unit tested).
    Never requires the bot token.
    """
    pattern: re.Pattern[str] | None = None
    if message_filter and message_filter.strip():
        pattern = re.compile(message_filter, re.I)

    jobs: list[RawJob] = []
    for upd in updates:
        msg = upd.get("channel_post") or upd.get("message")
        if not isinstance(msg, dict):
            continue
        chat = msg.get("chat")
        if not isinstance(chat, dict):
            continue
        if not _channel_matches(chat, channel_id):
            continue
        text = (msg.get("text") or msg.get("caption") or "").strip()
        if not text:
            continue
        if pattern and not pattern.search(text):
            continue

        message_id = msg.get("message_id")
        chat_id = chat.get("id")
        external = f"tg:{chat_id}:{message_id}"
        source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]
        urls = _URL_RE.findall(text)[:5]
        title = text.split("\n", 1)[0][:200]
        username = chat.get("username")
        source_url = (
            f"https://t.me/{username}/{message_id}"
            if username and message_id
            else (urls[0] if urls else None)
        )
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=source_url,
                title=title or None,
                company=username or str(chat_id),
                dedup_parts=[external, title.lower()],
                raw_data={
                    "text": text[:4000],
                    "message_id": message_id,
                    "chat_id": chat_id,
                    "username": username,
                    "date": msg.get("date"),
                    "urls": urls,
                    "format": "telegram",
                },
            )
        )
    return jobs


class TelegramCollector(BaseCollector):
    source_type = "telegram"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        bot_token = str(config.get("botToken") or "").strip()
        channel_id = str(config.get("channelId") or "").strip()
        message_filter = config.get("messageFilter")
        if not bot_token or not channel_id:
            raise ValueError("telegram config requires botToken and channelId")

        limit = max(1, min(int(config.get("limit") or 50), 100))
        # Never log bot_token (HG-8 / FAILURE clause)
        logger.info(
            "telegram_collect_start channel_configured=%s limit=%s",
            bool(channel_id),
            limit,
        )

        url = f"{_TG_API}/bot{bot_token}/getUpdates"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(
                    url,
                    params={
                        "limit": limit,
                        "allowed_updates": '["channel_post","message"]',
                    },
                )
                if res.status_code >= 400:
                    raise RuntimeError(f"telegram_http_{res.status_code}")
                payload = res.json()
        except httpx.HTTPError:
            # Never re-raise with URL containing bot token
            raise RuntimeError("telegram_http_error") from None

        if not payload.get("ok"):
            raise RuntimeError("telegram_api_error")

        updates = payload.get("result") or []
        if not isinstance(updates, list):
            updates = []

        jobs = updates_to_raw_jobs(
            updates,
            channel_id=channel_id,
            message_filter=str(message_filter) if message_filter else None,
        )
        logger.info("telegram_collect_done jobs=%s updates=%s", len(jobs), len(updates))
        return jobs

"""Publish realtime events to a user-scoped Redis channel (P11.5)."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis

from config import settings

logger = logging.getLogger(__name__)

_BLOCKED_KEYS = frozenset(
    {
        "body",
        "body_text",
        "tailored_cv",
        "cover_letter",
        "cv_text",
        "snippet",
        "raw_html",
    }
)


def user_channel(user_id: str) -> str:
    return f"jobautomater:ws:{user_id}"


def _strip_pii(event: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in event.items() if k not in _BLOCKED_KEYS}


def publish_event(user_id: str, event: dict[str, Any]) -> None:
    """Publish to this user only. Never logs payload (HG-8)."""
    if not user_id:
        return
    payload = _strip_pii(event)
    try:
        client = redis.Redis.from_url(
            settings.celery_broker_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        client.publish(user_channel(user_id), json.dumps(payload))
        logger.info("ws_publish type=%s", payload.get("type"))
    except Exception:  # noqa: BLE001
        logger.warning("ws_publish_failed type=%s", payload.get("type"))

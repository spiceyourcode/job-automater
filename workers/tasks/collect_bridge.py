"""Bridge: API LPUSH → Redis list → Celery tasks.collect_source (HG-10)."""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

import redis
from celery.signals import worker_ready, worker_shutdown

from config import settings

logger = logging.getLogger(__name__)

COLLECT_QUEUE_KEY = "jobautomater:collect_source"

_stop = threading.Event()
_thread: threading.Thread | None = None


def _redis_client() -> redis.Redis:
    # Prefer CELERY broker host; API uses REDIS_URL / same Redis
    return redis.Redis.from_url(settings.celery_broker_url, decode_responses=True)


def _loop() -> None:
    client = _redis_client()
    logger.info("collect_bridge_started key=%s", COLLECT_QUEUE_KEY)
    while not _stop.is_set():
        try:
            item = client.brpop(COLLECT_QUEUE_KEY, timeout=2)
            if not item:
                continue
            _key, raw = item
            try:
                payload: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("collect_bridge_bad_json")
                continue
            # Late import avoids circular import at module load
            from tasks.collect_source import collect_source

            collect_source.delay(payload)
            logger.info(
                "collect_bridge_enqueued source_id=%s type=%s",
                payload.get("source_id"),
                payload.get("source_type"),
            )
        except Exception:  # noqa: BLE001
            logger.exception("collect_bridge_error")
            _stop.wait(1)
    logger.info("collect_bridge_stopped")


@worker_ready.connect
def _on_ready(**_kwargs: Any) -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="collect-bridge", daemon=True)
    _thread.start()


@worker_shutdown.connect
def _on_shutdown(**_kwargs: Any) -> None:
    _stop.set()

"""Bridge: API Redis lists → Celery tasks (collect_source, generate_docs)."""

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
GENERATE_DOCS_KEY = "jobautomater:generate_docs"
SUBMIT_APPLICATION_KEY = "jobautomater:submit_application"

_stop = threading.Event()
_thread: threading.Thread | None = None


def _redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.celery_broker_url, decode_responses=True)


def _dispatch(key: str, payload: dict[str, Any]) -> None:
    if key == COLLECT_QUEUE_KEY:
        from tasks.collect_source import collect_source

        collect_source.delay(payload)
        logger.info(
            "bridge_collect source_id=%s",
            payload.get("source_id"),
        )
    elif key == GENERATE_DOCS_KEY:
        from tasks.generate_docs import generate_docs

        generate_docs.delay(payload)
        logger.info(
            "bridge_generate_docs application_id=%s",
            payload.get("application_id"),
        )
    elif key == SUBMIT_APPLICATION_KEY:
        from tasks.submit_application import submit_application

        # HG-4: only dispatch when approved_at present
        if not payload.get("approved_at"):
            logger.warning("bridge_submit_rejected reason=missing_approved_at")
            return
        submit_application.delay(payload)
        logger.info(
            "bridge_submit_application application_id=%s",
            payload.get("application_id"),
        )


def _loop() -> None:
    client = _redis_client()
    logger.info("queue_bridge_started")
    while not _stop.is_set():
        try:
            item = client.brpop(
                [COLLECT_QUEUE_KEY, GENERATE_DOCS_KEY, SUBMIT_APPLICATION_KEY],
                timeout=2,
            )
            if not item:
                continue
            key, raw = item
            try:
                payload: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("bridge_bad_json key=%s", key)
                continue
            _dispatch(key, payload)
        except Exception:  # noqa: BLE001
            logger.exception("bridge_error")
            _stop.wait(1)
    logger.info("queue_bridge_stopped")


@worker_ready.connect
def _on_ready(**_kwargs: Any) -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="queue-bridge", daemon=True)
    _thread.start()


@worker_shutdown.connect
def _on_shutdown(**_kwargs: Any) -> None:
    _stop.set()

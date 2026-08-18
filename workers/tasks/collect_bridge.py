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
MONITOR_EMAIL_KEY = "jobautomater:monitor_email"
REINDEX_CV_KEY = "jobautomater:reindex_cv"
MATCH_SCORE_KEY = "jobautomater:match_score"
ENRICH_COMPANY_KEY = "jobautomater:enrich_company"
INTERVIEW_PREP_KEY = "jobautomater:interview_prep"
VIDEO_COVER_KEY = "jobautomater:video_cover"

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
    elif key == MONITOR_EMAIL_KEY:
        from tasks.monitor_email import monitor_email

        monitor_email.delay(payload)
        logger.info(
            "bridge_monitor_email user_id=%s messages=%s",
            payload.get("user_id"),
            len(payload.get("messages") or []),
        )
    elif key == REINDEX_CV_KEY:
        from tasks.reindex_cv import reindex_cv

        reindex_cv.delay(payload)
        logger.info(
            "bridge_reindex_cv cv_document_id=%s task_id=%s",
            payload.get("cv_document_id"),
            payload.get("task_id"),
        )
    elif key == MATCH_SCORE_KEY:
        from tasks.match_score import match_score

        match_score.delay(payload)
        logger.info(
            "bridge_match_score user_id=%s jobs=%s",
            payload.get("user_id"),
            len(payload.get("job_ids") or []),
        )
    elif key == ENRICH_COMPANY_KEY:
        from tasks.enrich_company import enrich_company

        enrich_company.delay(payload)
        logger.info(
            "bridge_enrich_company user_id=%s jobs=%s",
            payload.get("user_id"),
            len(payload.get("job_ids") or []),
        )
    elif key == INTERVIEW_PREP_KEY:
        from tasks.interview_prep import interview_prep

        interview_prep.delay(payload)
        logger.info(
            "bridge_interview_prep application_id=%s",
            payload.get("application_id"),
        )
    elif key == VIDEO_COVER_KEY:
        from tasks.video_cover import video_cover

        video_cover.delay(payload)
        logger.info(
            "bridge_video_cover application_id=%s",
            payload.get("application_id"),
        )


def _loop() -> None:
    client = _redis_client()
    logger.info("queue_bridge_started")
    while not _stop.is_set():
        try:
            item = client.brpop(
                [
                    COLLECT_QUEUE_KEY,
                    GENERATE_DOCS_KEY,
                    SUBMIT_APPLICATION_KEY,
                    MONITOR_EMAIL_KEY,
                    REINDEX_CV_KEY,
                    MATCH_SCORE_KEY,
                    ENRICH_COMPANY_KEY,
                    INTERVIEW_PREP_KEY,
                    VIDEO_COVER_KEY,
                ],
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

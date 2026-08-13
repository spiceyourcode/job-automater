"""Celery task: reindex CV document into cv_chunks (HG-8/HG-9)."""

from __future__ import annotations

import logging
from typing import Any

from agents.cv_reindex.rechunk import reindex_document
from celery_app import app
from db import connect

logger = logging.getLogger(__name__)


@app.task(name="tasks.reindex_cv", bind=True, max_retries=2)
def reindex_cv(self, payload: dict[str, Any]) -> dict[str, Any]:  # noqa: ARG002
    user_id = payload.get("user_id")
    cv_document_id = payload.get("cv_document_id")
    task_id = payload.get("task_id")
    if not user_id or not cv_document_id:
        logger.warning("reindex_cv_missing_ids")
        return {"status": "error", "error": "missing_ids"}

    # Never log parsed text / filenames (HG-8)
    logger.info(
        "reindex_cv_start task_id=%s cv_document_id=%s",
        task_id,
        cv_document_id,
    )

    with connect() as conn:
        result = reindex_document(conn, str(user_id), str(cv_document_id))

    logger.info(
        "reindex_cv_done task_id=%s status=%s chunk_count=%s",
        task_id,
        result.get("status"),
        result.get("chunk_count"),
    )
    return result

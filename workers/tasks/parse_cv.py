"""Celery task: OCR-parse CV PDF and chain reindex (HG-8/HG-9)."""

from __future__ import annotations

import logging
from typing import Any

from celery_app import app
from db import connect
from lib.cv_extract import CvExtractError, extract_pdf_with_indra
from storage import download_bytes

logger = logging.getLogger(__name__)

PDF_MIME = "application/pdf"


def _load_cv_doc(conn, user_id: str, cv_document_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, file_url, mime_type, original_filename
            FROM cv_documents
            WHERE id = %s::uuid AND user_id = %s::uuid
            LIMIT 1
            """,
            (cv_document_id, user_id),
        )
        return cur.fetchone()


@app.task(name="tasks.parse_cv", bind=True, max_retries=1)
def parse_cv(self, payload: dict[str, Any]) -> dict[str, Any]:  # noqa: ARG002
    user_id = payload.get("user_id")
    cv_document_id = payload.get("cv_document_id")
    task_id = payload.get("task_id")
    if not user_id or not cv_document_id:
        logger.warning("parse_cv_missing_ids")
        return {"status": "error", "error": "missing_ids"}

    logger.info(
        "parse_cv_start task_id=%s cv_document_id=%s",
        task_id,
        cv_document_id,
    )

    try:
        with connect() as conn:
            doc = _load_cv_doc(conn, str(user_id), str(cv_document_id))
            if not doc:
                return {"status": "error", "error": "cv_not_found"}

            mime = (doc.get("mime_type") or "").lower()
            name = (doc.get("original_filename") or "").lower()
            is_pdf = mime == PDF_MIME or name.endswith(".pdf")
            if not is_pdf:
                return {"status": "error", "error": "not_pdf"}

            key = str(doc.get("file_url") or "")
            if not key:
                return {"status": "error", "error": "missing_file_key"}

            data = download_bytes(key)
            text = extract_pdf_with_indra(data)

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE cv_documents
                    SET parsed_text = %s
                    WHERE id = %s::uuid AND user_id = %s::uuid
                    """,
                    (text, cv_document_id, user_id),
                )
    except CvExtractError as exc:
        logger.warning(
            "parse_cv_extract_failed task_id=%s cv_document_id=%s err=%s",
            task_id,
            cv_document_id,
            exc.args[0] if exc.args else "extract_failed",
        )
        return {"status": "error", "error": str(exc)}
    except Exception:
        logger.warning("parse_cv_failed task_id=%s cv_document_id=%s", task_id, cv_document_id)
        return {"status": "error", "error": "parse_failed"}

    from tasks.reindex_cv import reindex_cv

    chain_task_id = task_id or payload.get("task_id")
    reindex_cv.delay(
        {
            "task_id": chain_task_id,
            "user_id": user_id,
            "cv_document_id": cv_document_id,
        }
    )
    logger.info("parse_cv_done task_id=%s cv_document_id=%s", task_id, cv_document_id)
    return {"status": "ok", "reindex_enqueued": True}
"""Pure CV rechunk helpers — no DB/Celery imports (testable offline)."""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def split_paragraphs(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if parts:
        return parts
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return lines or ([text.strip()] if text.strip() else [])


def reindex_document(conn: Any, user_id: str, cv_document_id: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id, parsed_text, chunk_count
            FROM cv_documents
            WHERE id = %s::uuid AND user_id = %s::uuid
            LIMIT 1
            """,
            (cv_document_id, user_id),
        )
        doc = cur.fetchone()
        if not doc:
            return {"status": "error", "error": "cv_not_found"}

        # Drop existing chunks first — no orphan embeddings (FAILURE clause)
        cur.execute(
            "DELETE FROM cv_chunks WHERE cv_document_id = %s::uuid AND user_id = %s::uuid",
            (cv_document_id, user_id),
        )

        parsed = doc.get("parsed_text") or ""
        paragraphs = split_paragraphs(parsed)
        if not paragraphs:
            logger.warning(
                "reindex_cv_empty_parsed_text cv_document_id=%s",
                cv_document_id,
            )
            cur.execute(
                """
                UPDATE cv_documents
                SET chunk_count = 0, last_chunked_at = NOW()
                WHERE id = %s::uuid AND user_id = %s::uuid
                """,
                (cv_document_id, user_id),
            )
            return {"status": "error", "error": "empty_parsed_text", "chunk_count": 0}

        vectors: list[list[float] | None] = [None] * len(paragraphs)
        try:
            from lib.embeddings import embed_texts

            vectors = embed_texts(paragraphs)
        except Exception:  # noqa: BLE001
            logger.warning("reindex_embed_skipped")
            vectors = [None] * len(paragraphs)

        embedded = 0
        for idx, content in enumerate(paragraphs):
            vec = vectors[idx] if idx < len(vectors) else None
            if vec is not None:
                from lib.embeddings import vector_literal

                lit = vector_literal(vec)
                cur.execute(
                    """
                    INSERT INTO cv_chunks (
                      cv_document_id, user_id, chunk_index, content,
                      token_count, section_type, embedding
                    ) VALUES (
                      %s::uuid, %s::uuid, %s, %s, %s, %s, %s::vector
                    )
                    """,
                    (
                        cv_document_id,
                        user_id,
                        idx,
                        content,
                        max(1, len(content.split())),
                        "body",
                        lit,
                    ),
                )
                embedded += 1
            else:
                cur.execute(
                    """
                    INSERT INTO cv_chunks (
                      cv_document_id, user_id, chunk_index, content, token_count, section_type
                    ) VALUES (
                      %s::uuid, %s::uuid, %s, %s, %s, %s
                    )
                    """,
                    (
                        cv_document_id,
                        user_id,
                        idx,
                        content,
                        max(1, len(content.split())),
                        "body",
                    ),
                )

        cur.execute(
            """
            UPDATE cv_documents
            SET chunk_count = %s, last_chunked_at = NOW()
            WHERE id = %s::uuid AND user_id = %s::uuid
            """,
            (len(paragraphs), cv_document_id, user_id),
        )
        cur.execute(
            """
            UPDATE profiles
            SET cv_last_indexed_at = NOW(), updated_at = NOW()
            WHERE user_id = %s::uuid
            """,
            (user_id,),
        )

    return {
        "status": "ok",
        "chunk_count": len(paragraphs),
        "embedded_count": embedded,
    }

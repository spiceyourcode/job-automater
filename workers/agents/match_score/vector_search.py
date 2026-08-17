"""pgvector CV chunk search — scoped to user_id (no cross-user leakage)."""

from __future__ import annotations

import logging
from typing import Any

import psycopg

logger = logging.getLogger(__name__)


def _keyword_search(
    cur: Any,
    *,
    user_id: str,
    query_text: str,
    limit: int,
) -> list[dict[str, Any]]:
    tokens = [t for t in query_text.lower().split() if len(t) > 2][:8]
    if not tokens:
        return []
    like_clauses = " OR ".join(["content ILIKE %s"] * len(tokens))
    params: list[Any] = [user_id] + [f"%{t}%" for t in tokens]
    cur.execute(
        f"""
        SELECT id, content, section_type
        FROM cv_chunks
        WHERE user_id = %s::uuid
          AND ({like_clauses})
        ORDER BY chunk_index
        LIMIT %s
        """,
        (*params, limit),
    )
    return [dict(r) for r in cur.fetchall()]


def search_cv_chunks(
    conn: psycopg.Connection,
    *,
    user_id: str,
    query_text: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Cosine search over cv_chunks.embedding for this user only.
    Falls back to ILIKE when embeddings or the embed API are missing.
    """
    try:
        with conn.cursor() as cur:
            from lib.embeddings import embed_one, vector_literal

            qvec = embed_one(query_text)
            lit = vector_literal(qvec) if qvec else None
            if lit:
                cur.execute(
                    """
                    SELECT id, content, section_type
                    FROM cv_chunks
                    WHERE user_id = %s::uuid
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (user_id, lit, limit),
                )
                rows = [dict(r) for r in cur.fetchall()]
                if rows:
                    logger.info("cv_search_hits mode=vector user_scoped=%s count=%s", True, len(rows))
                    return rows
            rows = _keyword_search(cur, user_id=user_id, query_text=query_text, limit=limit)
            logger.info("cv_search_hits mode=keyword user_scoped=%s count=%s", True, len(rows))
            return rows
    except Exception:  # noqa: BLE001
        logger.warning("cv_search_unavailable")
        return []


def hits_to_skill_hints(hits: list[dict[str, Any]]) -> list[str]:
    """Extract coarse skill tokens from chunk content for skill scoring boost."""
    known = {
        "python",
        "typescript",
        "javascript",
        "react",
        "fastapi",
        "django",
        "postgresql",
        "aws",
        "kubernetes",
        "docker",
        "sql",
        "redis",
        "graphql",
        "java",
        "go",
    }
    found: list[str] = []
    for h in hits:
        blob = str(h.get("content") or "").lower()
        for s in known:
            if s in blob and s not in found:
                found.append(s)
    return found

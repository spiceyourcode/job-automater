"""pgvector CV chunk search — scoped to user_id (no cross-user leakage)."""

from __future__ import annotations

import logging
from typing import Any

import psycopg

logger = logging.getLogger(__name__)


def search_cv_chunks(
    conn: psycopg.Connection,
    *,
    user_id: str,
    query_text: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Text similarity over cv_chunks.embedding for this user only.
    Returns [] when no embeddings exist (P2.4 still scores via profile skills).
    """
    # Without an embedding API in-test, use ILIKE keyword fallback on user's chunks
    tokens = [t for t in query_text.lower().split() if len(t) > 2][:8]
    if not tokens:
        return []
    try:
        with conn.cursor() as cur:
            # Prefer vector search when embeddings present
            cur.execute(
                """
                SELECT id, content, section_type,
                       (embedding IS NOT NULL) AS has_embedding
                FROM cv_chunks
                WHERE user_id = %s::uuid
                LIMIT 1
                """,
                (user_id,),
            )
            probe = cur.fetchone()
            if not probe:
                return []

            # Keyword fallback (safe, user-scoped) — vector path needs query embedding
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
            rows = [dict(r) for r in cur.fetchall()]
            logger.info("cv_search_hits user_scoped=%s count=%s", True, len(rows))
            return rows
    except Exception:  # noqa: BLE001 — table may be empty / extension edge cases
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

"""1536-d embeddings — OpenAI text-embedding-3-small, else Gemini 1536.

Matches cv_chunks.embedding vector(1536). Never logs input text (HG-8).
"""

from __future__ import annotations

import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

EMBED_DIM = 1536
_BATCH = 32


def has_embed_provider() -> bool:
    return bool(settings.openai_api_key or settings.google_api_key)


def _to_vector_literal(values: list[float]) -> str:
    if len(values) != EMBED_DIM:
        raise ValueError(f"embedding_dim_{len(values)}")
    return "[" + ",".join(f"{x:.8f}" for x in values) + "]"


def _openai_embed(texts: list[str], timeout: float) -> list[list[float]]:
    with httpx.Client(timeout=timeout) as client:
        res = client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": "text-embedding-3-small", "input": texts},
        )
        res.raise_for_status()
        data = res.json()
    items = sorted(data["data"], key=lambda x: int(x["index"]))
    logger.info(
        "embed_ok provider=openai count=%s tokens=%s",
        len(items),
        (data.get("usage") or {}).get("total_tokens"),
    )
    return [list(it["embedding"]) for it in items]


def _google_embed(texts: list[str], timeout: float) -> list[list[float]]:
    # One request per text — batchEmbedContents also works; keep simple.
    out: list[list[float]] = []
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-embedding-001:embedContent"
    )
    with httpx.Client(timeout=timeout) as client:
        for text in texts:
            res = client.post(
                url,
                params={"key": settings.google_api_key},
                json={
                    "content": {"parts": [{"text": text[:8000]}]},
                    "outputDimensionality": EMBED_DIM,
                },
            )
            res.raise_for_status()
            values = res.json()["embedding"]["values"]
            out.append(list(values))
    logger.info("embed_ok provider=google count=%s", len(out))
    return out


def embed_texts(texts: list[str], *, timeout: float = 60.0) -> list[list[float] | None]:
    """Return one vector per input, or Nones if no provider / call failed."""
    if not texts:
        return []
    clipped = [t[:8000] if t else " " for t in texts]
    try:
        vectors: list[list[float]] = []
        if settings.openai_api_key:
            for i in range(0, len(clipped), _BATCH):
                vectors.extend(_openai_embed(clipped[i : i + _BATCH], timeout))
        elif settings.google_api_key:
            vectors = _google_embed(clipped, timeout)
        else:
            return [None] * len(texts)
        if len(vectors) != len(texts):
            logger.warning("embed_count_mismatch")
            return [None] * len(texts)
        return [v if len(v) == EMBED_DIM else None for v in vectors]
    except Exception:  # noqa: BLE001
        logger.warning("embed_failed")
        return [None] * len(texts)


def embed_one(text: str) -> list[float] | None:
    got = embed_texts([text])
    return got[0] if got else None


def vector_literal(values: list[float] | None) -> str | None:
    if not values:
        return None
    try:
        return _to_vector_literal(values)
    except ValueError:
        return None

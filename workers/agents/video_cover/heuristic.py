"""Heuristic video cover-letter script from job + cv_chunks only (HG-9)."""

from __future__ import annotations

import re
from typing import Any


def _sentences(text: str) -> list[str]:
    parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def generate_video_script_heuristic(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
) -> dict[str, Any]:
    company = str(job.get("company") or "this team")[:120]
    title = str(job.get("title") or "this role")[:120]
    usable = [
        c
        for c in chunks
        if c.get("id") and str(c.get("content") or "").strip()
    ]
    sentences: list[str] = []
    chunk_ids: list[str] = []
    for c in usable[:6]:
        sents = _sentences(str(c.get("content") or ""))
        if not sents:
            continue
        sentences.append(sents[0][:400])
        cid = str(c["id"])
        if cid not in chunk_ids:
            chunk_ids.append(cid)
        if len(sentences) >= 4:
            break
    if not sentences or not chunk_ids:
        raise ValueError("no_cv_chunks")

    hook = sentences[0]
    body = " ".join(sentences[1:3]) if len(sentences) > 1 else sentences[0]
    close = f"I would welcome a conversation about the {title} role at {company}."
    script = f"{hook} {body} {close}".strip()
    words = len(script.split())
    seconds = min(180, max(20, round(words / 2.5)))
    return {
        "script": script[:4000],
        "hook": hook[:800],
        "close": close[:500],
        "chunk_ids": chunk_ids[:20],
        "estimated_seconds": int(seconds),
        "model_used": "heuristic-video-cl-v1",
    }

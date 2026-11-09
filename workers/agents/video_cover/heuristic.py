"""Heuristic video cover-letter script from job + cv_chunks only (HG-9)."""

from __future__ import annotations

import re
from typing import Any

from lib.cv_chunk_filters import (
    chunk_action_verbs,
    chunk_contact_noise_ratio,
    clean_cv_header,
    cv_sentences,
    is_story_chunk,
    rank_story_chunks,
)


def _speakable_sentences(text: str) -> list[str]:
    cleaned = clean_cv_header(text)
    out: list[str] = []
    for sent in cv_sentences(cleaned):
        if len(sent) < 24:
            continue
        if re.search(r"[\w.-]+@[\w.-]+\.\w+", sent):
            continue
        if re.search(r"fundamentals of .+ - ", sent, re.I):
            continue
        if not re.search(r"[.!?]$", sent):
            sent = sent.rstrip(".") + "."
        out.append(sent[:400])
    return out


def generate_video_script_heuristic(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
) -> dict[str, Any]:
    company = str(job.get("company") or "this team")[:120]
    title = str(job.get("title") or "this role")[:120]
    ranked = rank_story_chunks(chunks)
    if not ranked:
        ranked = [
            c
            for c in chunks
            if c.get("id")
            and str(c.get("content") or "").strip()
            and chunk_contact_noise_ratio(str(c.get("content") or "")) < 0.6
        ]
    usable = ranked or [
        c for c in chunks if c.get("id") and str(c.get("content") or "").strip()
    ]

    sentences: list[str] = []
    chunk_ids: list[str] = []
    for c in usable[:6]:
        sents = _speakable_sentences(str(c.get("content") or ""))
        if not sents and chunk_action_verbs(str(c.get("content") or "")):
            sents = _speakable_sentences(str(c.get("content") or ""))
        for sent in sents[:3]:
            if sent in sentences:
                continue
            sentences.append(sent)
            cid = str(c["id"])
            if cid not in chunk_ids:
                chunk_ids.append(cid)
            if len(sentences) >= 4:
                break
        if len(sentences) >= 4:
            break

    if not sentences or not chunk_ids:
        raise ValueError("no_cv_chunks")

    hook = sentences[0]
    if len(sentences) == 1:
        hook = f"Hi, I am excited about the {title} opportunity at {company}. {hook}"
    body = " ".join(sentences[1:3]) if len(sentences) > 1 else ""
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
        "model_used": "heuristic-video-cl-v2",
    }

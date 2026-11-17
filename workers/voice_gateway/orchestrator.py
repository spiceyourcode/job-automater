"""Per-connection turn orchestration: STT → Ollama stream → Piper chunks."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

from voice_gateway.pipeline import (
    PipelineError,
    build_system_prompt,
    stream_chat_ollama,
    synthesize_piper,
    transcribe_pcm16_wav,
)
from voice_gateway.sentences import finalize_sentence_tail, flush_sentences

logger = logging.getLogger(__name__)


def new_turn_id() -> str:
    return f"t-{uuid.uuid4().hex[:12]}"


@dataclass
class TurnContext:
    turn_id: str
    _cancelled: bool = field(default=False, repr=False)

    def cancel(self) -> None:
        self._cancelled = True

    @property
    def cancelled(self) -> bool:
        return self._cancelled


def iter_ollama_sentences(
    token_iter: Iterable[str],
    turn: TurnContext,
    *,
    max_chars: int = 160,
) -> Iterable[str]:
    buf = ""
    for piece in token_iter:
        if turn.cancelled:
            return
        buf += piece
        sentences, buf = flush_sentences(buf, max_chars=max_chars)
        for s in sentences:
            if turn.cancelled:
                return
            yield s
    for s in finalize_sentence_tail(buf):
        if turn.cancelled:
            return
        yield s


def run_assistant_stream(
    *,
    history: list[dict[str, str]],
    turn: TurnContext,
    on_sentence: Callable[[str], None],
) -> str:
    """Stream Ollama; invoke on_sentence per chunk; return full reply."""
    if turn.cancelled:
        return ""
    buf = ""
    spoken: list[str] = []
    try:
        for token in stream_chat_ollama(history):
            if turn.cancelled:
                break
            buf += token
            sentences, buf = flush_sentences(buf)
            for sentence in sentences:
                if turn.cancelled:
                    break
                on_sentence(sentence)
                spoken.append(sentence)
        for sentence in finalize_sentence_tail(buf):
            if turn.cancelled:
                break
            on_sentence(sentence)
            spoken.append(sentence)
        full = " ".join(spoken).strip() or buf.strip()[:400]
        if not full and not turn.cancelled:
            raise PipelineError("llm_empty")
        return full[:400]
    except PipelineError:
        if turn.cancelled:
            return ""
        raise


def process_pcm_utterance(
    *,
    ctx: dict[str, Any],
    history: list[dict[str, str]],
    pcm16: bytes,
    turn: TurnContext,
    on_sentence: Callable[[str], None],
) -> tuple[str, str]:
    if turn.cancelled:
        raise PipelineError("turn_cancelled")
    user_text = transcribe_pcm16_wav(pcm16)
    logger.info(
        "voice_turn session_id=%s turn_id=%s user_chars=%s",
        ctx.get("session_id"),
        turn.turn_id,
        len(user_text),
    )
    if turn.cancelled:
        raise PipelineError("turn_cancelled")
    history.append({"role": "user", "content": user_text})
    trimmed = _trim_history(history)
    reply = run_assistant_stream(history=trimmed, turn=turn, on_sentence=on_sentence)
    if turn.cancelled:
        raise PipelineError("turn_cancelled")
    history.clear()
    history.extend(trimmed)
    history.append({"role": "assistant", "content": reply})
    return user_text, reply


def synthesize_sentence(sentence: str) -> bytes:
    return synthesize_piper(sentence)


def ensure_history(ctx: dict[str, Any], history: list[dict[str, str]]) -> None:
    if not history:
        history.append({"role": "system", "content": build_system_prompt(ctx)})


def _trim_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    from voice_gateway.config import MAX_TURNS_KEPT

    if not history:
        return []
    return [history[0]] + history[1:][-MAX_TURNS_KEPT * 2 :]
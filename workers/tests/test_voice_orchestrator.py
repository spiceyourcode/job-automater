from __future__ import annotations

import asyncio
import struct
from unittest.mock import patch

import numpy as np

from voice_gateway.orchestrator import TurnContext, new_turn_id
from voice_gateway.sentences import finalize_sentence_tail, flush_sentences
from voice_gateway.vad import FRAME_BYTES, StreamVad, VadSignal


def _sine_pcm16(duration_ms: int, *, freq: float = 440.0, amp: float = 0.25) -> bytes:
    n = 16_000 * duration_ms // 1000
    t = np.arange(n, dtype=np.float32) / 16_000.0
    wave = (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)
    pcm = (wave * 32767.0).astype(np.int16)
    return pcm.tobytes()


def _silence_pcm16(duration_ms: int) -> bytes:
    n = 16_000 * duration_ms // 1000
    return b"\x00\x00" * n


def test_flush_sentences_splits_on_punctuation():
    parts, rest = flush_sentences("Hello there. And ")
    assert parts == ["Hello there."]
    assert rest == "And "


def test_finalize_sentence_tail():
    assert finalize_sentence_tail("  tail ") == ["tail"]
    assert finalize_sentence_tail("   ") == []


def test_stream_vad_detects_speech_end():
    vad = StreamVad(min_speech_ms=60, silence_ms=90, energy_threshold=0.01)
    signals: list[VadSignal] = []
    speech = _sine_pcm16(400)
    for i in range(0, len(speech), FRAME_BYTES):
        signals.append(vad.feed(speech[i : i + FRAME_BYTES]))
    silence = _silence_pcm16(200)
    for i in range(0, len(silence), FRAME_BYTES):
        signals.append(vad.feed(silence[i : i + FRAME_BYTES]))
    assert VadSignal.SPEECH_END in signals
    utterance = vad.take_utterance_pcm()
    assert len(utterance) > FRAME_BYTES


def test_new_turn_id_unique():
    a = new_turn_id()
    b = new_turn_id()
    assert a != b
    assert a.startswith("t-")


def test_turn_context_cancel():
    ctx = TurnContext(turn_id="t-1")
    assert not ctx.cancelled
    ctx.cancel()
    assert ctx.cancelled


def test_iter_ollama_sentences_respects_cancel():
    from voice_gateway.orchestrator import iter_ollama_sentences

    def fake_stream():
        yield "One. "
        yield "Two."

    ctx = TurnContext(turn_id="t-x")
    ctx.cancel()
    out = list(iter_ollama_sentences(fake_stream(), ctx))
    assert out == []


def test_iter_ollama_sentences_yields_parts():
    from voice_gateway.orchestrator import iter_ollama_sentences

    ctx = TurnContext(turn_id="t-y")
    out = list(iter_ollama_sentences(iter(["Hi. ", "Next?"]), ctx))
    assert out == ["Hi.", "Next?"]
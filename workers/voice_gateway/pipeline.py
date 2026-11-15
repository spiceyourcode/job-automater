"""STT / LLM / TTS pipeline (HG-8: no transcript bodies in logs)."""

from __future__ import annotations

import base64
import logging
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

import httpx

from voice_gateway.config import (
    MAX_TURNS_KEPT,
    OLLAMA_MODEL,
    OLLAMA_URL,
    VOICES_DIR,
    VOICE_NAME,
    WHISPER_MODEL,
)

logger = logging.getLogger(__name__)

_whisper = None
_voice_path: Path | None = None


class PipelineError(Exception):
    pass


def ensure_piper_voice() -> Path:
    global _voice_path  # noqa: PLW0603
    if _voice_path is not None and _voice_path.exists():
        return _voice_path
    root = Path(VOICES_DIR)
    root.mkdir(parents=True, exist_ok=True)
    base = VOICE_NAME
    for ext in (".onnx", ".onnx.json"):
        path = root / f"{base}{ext}"
        if not path.exists():
            url = (
                "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
                f"en/en_US/lessac/low/{base}{ext}"
            )
            logger.info("piper_download name=%s", base)
            urllib.request.urlretrieve(url, path)  # noqa: S310
    _voice_path = root / f"{base}.onnx"
    return _voice_path


def get_whisper():
    global _whisper  # noqa: PLW0603
    if _whisper is not None:
        return _whisper
    from faster_whisper import WhisperModel

    _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _whisper


def transcribe_audio(data: bytes, *, suffix: str = ".webm") -> str:
    if not data:
        raise PipelineError("empty_audio")
    stt = get_whisper()
    path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            path = Path(tmp.name)
        segments, _ = stt.transcribe(str(path), beam_size=1, vad_filter=True)
        text = " ".join(s.text for s in segments).strip()
        if not text:
            raise PipelineError("no_speech_detected")
        return text
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


def build_system_prompt(ctx: dict[str, Any]) -> str:
    title = str(ctx.get("job_title") or "software engineer")
    company = str(ctx.get("company") or "the company")
    topics = ctx.get("sample_questions") or []
    stars = ctx.get("star_titles") or []
    topic_s = " | ".join(str(t) for t in topics[:8])
    star_s = " | ".join(str(t) for t in stars[:5])
    return (
        f"You are a hiring manager interviewing for {title} at {company}. "
        "Ask ONE question per turn. Max two short spoken sentences. "
        "No lists, markdown, or emojis. Briefly acknowledge answers. "
        "Never invent employers or credentials. "
        f"Prep topics (do not read verbatim): {topic_s or 'general fit'}. "
        f"STAR titles for reference: {star_s or 'none'}."
    )


def chat_ollama(history: list[dict[str, str]]) -> str:
    body = {
        "model": OLLAMA_MODEL,
        "messages": history,
        "stream": False,
        "keep_alive": "30m",
        "options": {"num_predict": 120, "temperature": 0.7},
    }
    try:
        with httpx.Client(timeout=120.0) as client:
            res = client.post(OLLAMA_URL, json=body)
            res.raise_for_status()
            content = res.json()["message"]["content"].strip()
    except Exception as exc:
        raise PipelineError("ollama_unavailable") from exc
    if not content:
        raise PipelineError("ollama_empty")
    return content[:400]


def synthesize_piper(text: str) -> bytes:
    voice = ensure_piper_voice()
    out_path = tempfile.mktemp(suffix=".wav")
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "piper", "-m", str(voice), "-f", out_path],
            input=text.encode(),
            check=True,
            capture_output=True,
        )
        _ = proc
        return Path(out_path).read_bytes()
    except Exception as exc:
        raise PipelineError("piper_failed") from exc
    finally:
        if os.path.exists(out_path):
            os.unlink(out_path)


def audio_to_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def base64_to_audio(b64: str) -> bytes:
    return base64.b64decode(b64.encode("ascii"))


def process_utterance(
    *,
    ctx: dict[str, Any],
    history: list[dict[str, str]],
    audio: bytes,
    audio_format: str,
) -> tuple[str, str, bytes]:
    suffix = ".webm" if "webm" in audio_format.lower() else ".wav"
    user_text = transcribe_audio(audio, suffix=suffix)
    logger.info("voice_utterance chars=%s", len(user_text))
    history.append({"role": "user", "content": user_text})
    trimmed = [history[0]] + history[1:][-MAX_TURNS_KEPT * 2 :]
    reply = chat_ollama(trimmed)
    history.clear()
    history.extend(trimmed)
    history.append({"role": "assistant", "content": reply})
    wav = synthesize_piper(reply)
    return user_text, reply, wav


def opening_reply(ctx: dict[str, Any], history: list[dict[str, str]]) -> tuple[str, bytes]:
    history.append({"role": "user", "content": "Hello, I'm ready for the interview."})
    reply = chat_ollama(history)
    history.append({"role": "assistant", "content": reply})
    wav = synthesize_piper(reply)
    return reply, wav
"""Speech endpointing for streamed PCM16 mono @ 16 kHz (HG-8: no audio in logs)."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

SAMPLE_RATE = 16_000
FRAME_MS = 30
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1000
FRAME_BYTES = FRAME_SAMPLES * 2


class VadSignal(str, Enum):
    SILENCE = "silence"
    SPEECH = "speech"
    SPEECH_END = "speech_end"


@dataclass
class StreamVad:
    """Accumulates PCM16 chunks; emits SPEECH_END after trailing silence."""

    min_speech_ms: int = 300
    silence_ms: int = 700
    energy_threshold: float = 0.012
    aggressiveness: int = 2
    _pcm: bytearray = field(default_factory=bytearray)
    _pending: bytearray = field(default_factory=bytearray)
    _in_speech: bool = False
    _speech_ms: int = 0
    _silence_ms: int = 0
    _webrtc: object | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        try:
            import webrtcvad  # type: ignore import-not-found

            self._webrtc = webrtcvad.Vad(int(self.aggressiveness))
        except Exception:
            self._webrtc = None

    def reset(self) -> None:
        self._pcm.clear()
        self._pending.clear()
        self._in_speech = False
        self._speech_ms = 0
        self._silence_ms = 0

    def feed(self, chunk: bytes) -> VadSignal:
        if not chunk:
            return VadSignal.SILENCE
        self._pending.extend(chunk)
        signal = VadSignal.SILENCE
        while len(self._pending) >= FRAME_BYTES:
            frame = bytes(self._pending[:FRAME_BYTES])
            del self._pending[:FRAME_BYTES]
            voiced = self._frame_voiced(frame)
            if voiced:
                self._in_speech = True
                self._speech_ms += FRAME_MS
                self._silence_ms = 0
                self._pcm.extend(frame)
                signal = VadSignal.SPEECH
            elif self._in_speech:
                self._silence_ms += FRAME_MS
                self._pcm.extend(frame)
                if self._silence_ms >= self.silence_ms:
                    if self._speech_ms >= self.min_speech_ms and len(self._pcm) > 0:
                        signal = VadSignal.SPEECH_END
                    self._in_speech = False
                    self._speech_ms = 0
                    self._silence_ms = 0
        return signal

    def take_utterance_pcm(self) -> bytes:
        data = bytes(self._pcm)
        self._pcm.clear()
        return data

    def _frame_voiced(self, frame: bytes) -> bool:
        if self._webrtc is not None:
            try:
                return bool(self._webrtc.is_speech(frame, SAMPLE_RATE))  # type: ignore[union-attr]
            except Exception:
                pass
        import numpy as np

        pcm = np.frombuffer(frame, dtype=np.int16).astype(np.float32) / 32768.0
        if pcm.size == 0:
            return False
        rms = float(np.sqrt(np.mean(pcm * pcm)))
        return rms >= self.energy_threshold
from __future__ import annotations

import os

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "tiny.en")
VOICE_LLM_PROVIDER = os.environ.get("VOICE_LLM_PROVIDER", "auto").strip().lower()
VOICE_LLM_MODEL = os.environ.get("VOICE_LLM_MODEL", "").strip()
VOICE_NAME = os.environ.get("PIPER_VOICE", "en_US-lessac-low")
VOICES_DIR = os.environ.get("PIPER_VOICES_DIR", "voices")
HOST = os.environ.get("VOICE_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("VOICE_GATEWAY_PORT", "8765"))
MAX_TURNS_KEPT = 6

# Speaker→mic echo triggers false barge-in; off unless using headphones.
VOICE_BARGE_IN = os.environ.get("VOICE_BARGE_IN", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)
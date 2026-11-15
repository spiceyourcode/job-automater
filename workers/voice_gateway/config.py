from __future__ import annotations

import os

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:1b")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "tiny.en")
VOICE_NAME = os.environ.get("PIPER_VOICE", "en_US-lessac-low")
VOICES_DIR = os.environ.get("PIPER_VOICES_DIR", "voices")
HOST = os.environ.get("VOICE_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("VOICE_GATEWAY_PORT", "8765"))
MAX_TURNS_KEPT = 6
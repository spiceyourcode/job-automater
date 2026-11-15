# Voice gateway (local sidecar)

Runs on **127.0.0.1:8765** beside the Next.js app and Hono API. Handles STT (faster-whisper), chat (Ollama), and TTS (Piper). Turn text is still persisted via the Hono API — the gateway does not replace Celery or BullMQ.

## Prerequisites

1. **Ollama** — `ollama serve` and pull a small chat model, e.g. `ollama pull llama3.2:1b`.
2. **Piper voice** — place a `.onnx` + `.json` under `workers/voices/` (see `voice_gateway/config.py`).
3. **Python extra** — from `workers/`:

   ```bash
   pip install -e ".[voice]"
   ```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama HTTP API |
| `VOICE_GATEWAY_HOST` | `127.0.0.1` | Bind address |
| `VOICE_GATEWAY_PORT` | `8765` | WebSocket port |
| `VOICE_GATEWAY_WS` | `ws://127.0.0.1:8765/ws` | Returned by API on mock-interview start |
| `NEXT_PUBLIC_VOICE_GATEWAY_WS` | same | Browser WebSocket URL |

## Run

```bash
cd workers
python -m voice_gateway
# or: voice-gateway
```

Health: `GET http://127.0.0.1:8765/health`

## Web flow

1. User starts mock interview on `/applications/:id/mock-interview`.
2. API creates session + returns `voiceGatewayUrl` and `voiceContext`.
3. Browser opens WebSocket, sends `hello`, plays opening via `tts`, records utterances, syncs turns to `POST .../mock-interview/turn` with `assistantText` from the gateway.
4. On end, `POST .../mock-interview/evaluate` stores debrief JSON in `mock_interview_sessions.summary`.

If the gateway is down, the UI falls back to Web Speech + `speechSynthesis` (FR-IP-02).

## Logs (HG-8)

Gateway logs session id and phase only — not transcript text.
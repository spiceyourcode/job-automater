"""WebSocket voice gateway — localhost only."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from voice_gateway.config import HOST, PORT
from voice_gateway.pipeline import (
    PipelineError,
    audio_to_base64,
    base64_to_audio,
    build_system_prompt,
    opening_reply,
    process_utterance,
    synthesize_piper,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="JobAutomater Voice Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def send_json(ws: WebSocket, payload: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws")
async def voice_ws(ws: WebSocket) -> None:
    await ws.accept()
    history: list[dict[str, str]] = []
    ctx: dict[str, Any] = {}

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await send_json(ws, {"type": "error", "code": "bad_json"})
                continue

            kind = msg.get("type")
            if kind == "hello":
                ctx = {
                    "job_title": msg.get("jobTitle") or "Role",
                    "company": msg.get("company") or "Company",
                    "sample_questions": msg.get("sampleQuestions") or [],
                    "star_titles": msg.get("starTitles") or [],
                    "session_id": msg.get("sessionId"),
                }
                history = [{"role": "system", "content": build_system_prompt(ctx)}]
                logger.info(
                    "voice_hello session_id=%s",
                    ctx.get("session_id"),
                )
                await send_json(ws, {"type": "phase", "phase": "idle"})
                if msg.get("requestOpening"):
                    await send_json(ws, {"type": "phase", "phase": "thinking"})
                    try:
                        reply, wav = opening_reply(ctx, history)
                        await send_json(
                            ws,
                            {
                                "type": "text",
                                "role": "assistant",
                                "content": reply,
                            },
                        )
                        await send_json(ws, {"type": "phase", "phase": "speaking"})
                        await send_json(
                            ws,
                            {
                                "type": "audio",
                                "format": "wav",
                                "data": audio_to_base64(wav),
                            },
                        )
                        await send_json(ws, {"type": "phase", "phase": "idle"})
                    except PipelineError as exc:
                        await send_json(
                            ws,
                            {"type": "error", "code": str(exc.args[0] if exc.args else "pipeline")},
                        )

            elif kind == "tts":
                text = str(msg.get("text") or "").strip()
                if not text:
                    continue
                await send_json(ws, {"type": "phase", "phase": "thinking"})
                try:
                    wav = synthesize_piper(text)
                    await send_json(ws, {"type": "phase", "phase": "speaking"})
                    await send_json(
                        ws,
                        {
                            "type": "audio",
                            "format": "wav",
                            "data": audio_to_base64(wav),
                        },
                    )
                    await send_json(ws, {"type": "phase", "phase": "idle"})
                except PipelineError as exc:
                    await send_json(
                        ws,
                        {"type": "error", "code": str(exc.args[0] if exc.args else "tts")},
                    )

            elif kind == "utterance":
                b64 = str(msg.get("data") or "")
                fmt = str(msg.get("format") or "webm")
                if not history:
                    history = [{"role": "system", "content": build_system_prompt(ctx or {})}]
                if not b64:
                    await send_json(ws, {"type": "error", "code": "missing_audio"})
                    continue
                try:
                    audio = base64_to_audio(b64)
                    await send_json(ws, {"type": "phase", "phase": "thinking"})
                    user_text, reply, wav = process_utterance(
                        ctx=ctx,
                        history=history,
                        audio=audio,
                        audio_format=fmt,
                    )
                    await send_json(
                        ws,
                        {"type": "text", "role": "user", "content": user_text},
                    )
                    await send_json(
                        ws,
                        {"type": "text", "role": "assistant", "content": reply},
                    )
                    await send_json(ws, {"type": "phase", "phase": "speaking"})
                    await send_json(
                        ws,
                        {
                            "type": "audio",
                            "format": "wav",
                            "data": audio_to_base64(wav),
                        },
                    )
                    await send_json(ws, {"type": "phase", "phase": "idle"})
                except PipelineError as exc:
                    await send_json(
                        ws,
                        {"type": "error", "code": str(exc.args[0] if exc.args else "utterance")},
                    )
                    await send_json(ws, {"type": "phase", "phase": "idle"})

            elif kind == "end":
                await send_json(ws, {"type": "phase", "phase": "idle"})
                break
            else:
                await send_json(ws, {"type": "error", "code": "unknown_type"})

    except WebSocketDisconnect:
        logger.info("voice_ws_disconnect session_id=%s", ctx.get("session_id"))
    except Exception:
        logger.warning("voice_ws_failed session_id=%s", ctx.get("session_id"))
        try:
            await send_json(ws, {"type": "error", "code": "internal"})
        except Exception:
            pass


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
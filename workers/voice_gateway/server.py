"""WebSocket voice gateway — localhost only."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from voice_gateway.config import HOST, PORT, VOICE_BARGE_IN
from voice_gateway.orchestrator import (
    TurnContext,
    ensure_history,
    new_turn_id,
    process_pcm_utterance,
    synthesize_sentence,
)
from voice_gateway.pipeline import (
    PipelineError,
    audio_to_base64,
    base64_to_audio,
    build_system_prompt,
    opening_reply,
    process_utterance,
    synthesize_piper,
)
from voice_gateway.vad import StreamVad, VadSignal

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


async def cancel_active_turn(ws: WebSocket, turn: TurnContext | None) -> None:
    if turn is None:
        return
    turn.cancel()
    await send_json(ws, {"type": "interrupt", "turnId": turn.turn_id})


async def _emit_sentence(
    ws: WebSocket,
    turn: TurnContext,
    sentence: str,
    partial: str,
) -> str:
    merged = (partial + " " + sentence).strip()
    await send_json(
        ws,
        {
            "type": "partial_text",
            "role": "assistant",
            "content": merged,
            "turnId": turn.turn_id,
        },
    )
    if turn.cancelled:
        return merged
    wav = await asyncio.to_thread(synthesize_sentence, sentence)
    if turn.cancelled:
        return merged
    await send_json(
        ws,
        {
            "type": "audio_chunk",
            "format": "wav",
            "data": audio_to_base64(wav),
            "turnId": turn.turn_id,
        },
    )
    return merged


async def run_streaming_turn(
    ws: WebSocket,
    *,
    ctx: dict[str, Any],
    history: list[dict[str, str]],
    pcm16: bytes,
    turn: TurnContext,
    on_phase: Any = None,
) -> None:
    ensure_history(ctx, history)
    loop = asyncio.get_running_loop()
    sentence_queue: asyncio.Queue[str | None] = asyncio.Queue()

    def on_sentence(sentence: str) -> None:
        loop.call_soon_threadsafe(sentence_queue.put_nowait, sentence)

    async def pipeline() -> tuple[str, str]:
        try:
            return await asyncio.to_thread(
                process_pcm_utterance,
                ctx=ctx,
                history=history,
                pcm16=pcm16,
                turn=turn,
                on_sentence=on_sentence,
            )
        except PipelineError as exc:
            if str(exc.args[0] if exc.args else "") == "turn_cancelled":
                return ("", "")
            raise
        finally:
            loop.call_soon_threadsafe(sentence_queue.put_nowait, None)

    task = asyncio.create_task(pipeline())
    partial = ""
    spoke = False

    while True:
        if turn.cancelled:
            task.cancel()
            return
        try:
            sentence = await asyncio.wait_for(sentence_queue.get(), timeout=0.05)
        except TimeoutError:
            if task.done() and sentence_queue.empty():
                break
            continue
        if sentence is None:
            if task.done():
                break
            continue
        if not spoke:
            spoke = True
            if on_phase:
                await on_phase("speaking")
            else:
                await send_json(ws, {"type": "phase", "phase": "speaking"})
        partial = await _emit_sentence(ws, turn, sentence, partial)
        if turn.cancelled:
            return

    if turn.cancelled:
        return
    try:
        user_text, reply = await task
    except asyncio.CancelledError:
        return
    except PipelineError as exc:
        code = str(exc.args[0] if exc.args else "pipeline")
        if code in ("turn_cancelled", "no_speech_detected"):
            return
        raise

    if not user_text.strip() and not reply.strip():
        return

    await send_json(
        ws,
        {"type": "text", "role": "user", "content": user_text, "turnId": turn.turn_id},
    )
    await send_json(
        ws,
        {
            "type": "text",
            "role": "assistant",
            "content": reply,
            "turnId": turn.turn_id,
        },
    )
    await send_json(
        ws,
        {
            "type": "audio",
            "format": "wav",
            "data": "",
            "turnId": turn.turn_id,
            "final": True,
        },
    )
    await send_json(ws, {"type": "turn_end", "turnId": turn.turn_id})


@app.websocket("/ws")
async def voice_ws(ws: WebSocket) -> None:
    await ws.accept()
    history: list[dict[str, str]] = []
    ctx: dict[str, Any] = {}
    hands_free = False
    vad = StreamVad()
    active_turn: TurnContext | None = None
    turn_task: asyncio.Task[None] | None = None
    phase = "idle"

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
                hands_free = bool(msg.get("handsFree"))
                history = [{"role": "system", "content": build_system_prompt(ctx)}]
                vad.reset()
                logger.info(
                    "voice_hello session_id=%s hands_free=%s",
                    ctx.get("session_id"),
                    hands_free,
                )
                await send_json(ws, {"type": "phase", "phase": "idle"})
                if hands_free:
                    await send_json(
                        ws,
                        {"type": "listen_mode", "mode": "continuous", "enabled": True},
                    )
                if msg.get("requestOpening"):
                    await send_json(ws, {"type": "phase", "phase": "thinking"})
                    try:
                        reply, wav = await asyncio.to_thread(opening_reply, ctx, history)
                        turn_id = new_turn_id()
                        await send_json(
                            ws,
                            {
                                "type": "text",
                                "role": "assistant",
                                "content": reply,
                                "turnId": turn_id,
                            },
                        )
                        await send_json(ws, {"type": "phase", "phase": "speaking"})
                        await send_json(
                            ws,
                            {
                                "type": "audio",
                                "format": "wav",
                                "data": audio_to_base64(wav),
                                "turnId": turn_id,
                            },
                        )
                        await send_json(ws, {"type": "turn_end", "turnId": turn_id})
                        await send_json(ws, {"type": "phase", "phase": "idle"})
                    except PipelineError as exc:
                        await send_json(
                            ws,
                            {"type": "error", "code": str(exc.args[0] if exc.args else "pipeline")},
                        )

            elif kind == "interrupt":
                target = str(msg.get("turnId") or "")
                if active_turn and (not target or active_turn.turn_id == target):
                    await cancel_active_turn(ws, active_turn)
                    if turn_task and not turn_task.done():
                        turn_task.cancel()
                    vad.reset()
                    active_turn = None
                phase = "idle"
                await send_json(ws, {"type": "phase", "phase": "idle"})

            elif kind == "audio_chunk":
                if not hands_free:
                    continue
                pcm = base64_to_audio(str(msg.get("data") or ""))
                if not pcm:
                    continue
                signal = vad.feed(pcm)
                if (
                    VOICE_BARGE_IN
                    and phase == "speaking"
                    and active_turn
                    and signal == VadSignal.SPEECH
                ):
                    await cancel_active_turn(ws, active_turn)
                    if turn_task and not turn_task.done():
                        turn_task.cancel()
                    vad.reset()
                    active_turn = None
                    phase = "idle"
                    await send_json(ws, {"type": "phase", "phase": "idle"})
                if signal == VadSignal.SPEECH and phase == "idle":
                    phase = "listening"
                    await send_json(ws, {"type": "phase", "phase": "listening"})
                if signal == VadSignal.SPEECH_END:
                    utterance = vad.take_utterance_pcm()
                    vad.reset()
                    if not utterance:
                        continue
                    if phase in ("thinking", "speaking"):
                        continue
                    if turn_task and not turn_task.done():
                        turn_task.cancel()
                    active_turn = TurnContext(turn_id=new_turn_id())
                    phase = "thinking"
                    await send_json(
                        ws,
                        {"type": "turn_start", "turnId": active_turn.turn_id},
                    )
                    await send_json(ws, {"type": "phase", "phase": "thinking"})

                    async def _run() -> None:
                        nonlocal phase, active_turn

                        async def _set_phase(name: str) -> None:
                            nonlocal phase
                            phase = name
                            await send_json(ws, {"type": "phase", "phase": name})

                        try:
                            await run_streaming_turn(
                                ws,
                                ctx=ctx,
                                history=history,
                                pcm16=utterance,
                                turn=active_turn,  # type: ignore[arg-type]
                                on_phase=_set_phase,
                            )
                        except PipelineError as exc:
                            code = str(exc.args[0] if exc.args else "utterance")
                            if code == "turn_cancelled":
                                return
                            await send_json(
                                ws,
                                {"type": "error", "code": code},
                            )
                        finally:
                            phase = "idle"
                            active_turn = None
                            await send_json(ws, {"type": "phase", "phase": "idle"})

                    turn_task = asyncio.create_task(_run())

            elif kind == "tts":
                text = str(msg.get("text") or "").strip()
                if not text:
                    continue
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                await cancel_active_turn(ws, active_turn)
                active_turn = None
                await send_json(ws, {"type": "phase", "phase": "thinking"})
                turn_id = new_turn_id()
                try:
                    wav = await asyncio.to_thread(synthesize_piper, text)
                    await send_json(ws, {"type": "phase", "phase": "speaking"})
                    await send_json(
                        ws,
                        {
                            "type": "audio",
                            "format": "wav",
                            "data": audio_to_base64(wav),
                            "turnId": turn_id,
                        },
                    )
                    await send_json(ws, {"type": "turn_end", "turnId": turn_id})
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
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                await cancel_active_turn(ws, active_turn)
                try:
                    audio = base64_to_audio(b64)
                    await send_json(ws, {"type": "phase", "phase": "thinking"})
                    user_text, reply, wav = await asyncio.to_thread(
                        process_utterance,
                        ctx=ctx,
                        history=history,
                        audio=audio,
                        audio_format=fmt,
                    )
                    turn_id = new_turn_id()
                    await send_json(
                        ws,
                        {"type": "text", "role": "user", "content": user_text, "turnId": turn_id},
                    )
                    await send_json(
                        ws,
                        {
                            "type": "text",
                            "role": "assistant",
                            "content": reply,
                            "turnId": turn_id,
                        },
                    )
                    await send_json(ws, {"type": "phase", "phase": "speaking"})
                    await send_json(
                        ws,
                        {
                            "type": "audio",
                            "format": "wav",
                            "data": audio_to_base64(wav),
                            "turnId": turn_id,
                        },
                    )
                    await send_json(ws, {"type": "turn_end", "turnId": turn_id})
                    await send_json(ws, {"type": "phase", "phase": "idle"})
                except PipelineError as exc:
                    await send_json(
                        ws,
                        {"type": "error", "code": str(exc.args[0] if exc.args else "utterance")},
                    )
                    await send_json(ws, {"type": "phase", "phase": "idle"})
                except Exception as exc:
                    logger.warning(
                        "voice_utterance_failed session_id=%s err=%s",
                        ctx.get("session_id"),
                        type(exc).__name__,
                    )
                    await send_json(ws, {"type": "error", "code": "utterance_failed"})
                    await send_json(ws, {"type": "phase", "phase": "idle"})

            elif kind == "end":
                if turn_task and not turn_task.done():
                    turn_task.cancel()
                await cancel_active_turn(ws, active_turn)
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
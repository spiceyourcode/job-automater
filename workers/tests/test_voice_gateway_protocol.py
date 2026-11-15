from __future__ import annotations

import json
from unittest.mock import patch

from voice_gateway.pipeline import build_system_prompt


def test_build_system_prompt_includes_role():
    prompt = build_system_prompt(
        {
            "job_title": "Engineer",
            "company": "Acme",
            "sample_questions": ["Why us?"],
            "star_titles": ["Launch"],
        }
    )
    assert "Engineer" in prompt
    assert "Acme" in prompt
    assert "Why us?" in prompt


def test_process_utterance_mocked():
    from voice_gateway.pipeline import process_utterance

    ctx = {
        "job_title": "Engineer",
        "company": "Acme",
        "sample_questions": [],
        "star_titles": [],
    }
    history = [{"role": "system", "content": build_system_prompt(ctx)}]
    with (
        patch("voice_gateway.pipeline.transcribe_audio", return_value="I built APIs."),
        patch("voice_gateway.pipeline.chat_ollama", return_value="Tell me more about APIs."),
        patch("voice_gateway.pipeline.synthesize_piper", return_value=b"RIFF"),
    ):
        user, reply, wav = process_utterance(
            ctx=ctx,
            history=history,
            audio=b"x",
            audio_format="webm",
        )
    assert user == "I built APIs."
    assert "APIs" in reply
    assert wav == b"RIFF"


def test_ws_hello_returns_idle():
    from fastapi.testclient import TestClient

    from voice_gateway.server import app

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text(
            json.dumps(
                {
                    "type": "hello",
                    "sessionId": "sess-1",
                    "jobTitle": "Engineer",
                    "company": "Acme",
                }
            )
        )
        msg = json.loads(ws.receive_text())
        assert msg == {"type": "phase", "phase": "idle"}


def test_ws_tts_mocked():
    from fastapi.testclient import TestClient

    from voice_gateway.server import app

    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "hello", "sessionId": "sess-2"}))
        ws.receive_text()
        with patch(
            "voice_gateway.server.synthesize_piper",
            return_value=b"RIFFxxxx",
        ):
            ws.send_text(json.dumps({"type": "tts", "text": "Welcome."}))
            phases = []
            while True:
                raw = ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "phase":
                    phases.append(msg["phase"])
                if msg.get("type") == "audio":
                    assert msg.get("format") == "wav"
                    break
            assert "thinking" in phases
            assert "speaking" in phases
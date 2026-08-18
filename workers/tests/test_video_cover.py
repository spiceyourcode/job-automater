"""P13.8 Video cover script — HG-9 grounding tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from agents.video_cover.graph import run_video_cover
from agents.video_cover.schema import assert_script_grounded, validate_video_cover
from tasks.video_cover import VideoCoverJob, process_video_cover

CHUNK_A = {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "content": (
        "Built REST APIs with FastAPI and PostgreSQL at Acme Corp from 2020 to 2023. "
        "Led a migration of billing services. Reduced incident volume for production."
    ),
    "section_type": "experience",
    "chunk_index": 0,
}

JOB = {
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "title": "Senior Python Engineer",
    "company": "Nimbus",
    "description": "FastAPI role with PostgreSQL",
}


def test_heuristic_script_is_grounded():
    pack = run_video_cover(chunks=[CHUNK_A], job=JOB)
    assert pack is not None
    model = validate_video_cover(pack)
    assert_script_grounded(model, [CHUNK_A])
    assert "Nimbus" in model.close
    assert "FastAPI" in model.hook
    assert isinstance(model.estimated_seconds, int)


def test_payload_rejects_extra_fields():
    with pytest.raises(ValidationError):
        VideoCoverJob.model_validate(
            {
                "application_id": "11111111-1111-4111-8111-111111111111",
                "user_id": "22222222-2222-4222-8222-222222222222",
                "job_id": "33333333-3333-4333-8333-333333333333",
                "cv_text": "secret",
            }
        )


def test_process_skips_other_users_application():
    with (
        patch("tasks.video_cover.connect") as mock_connect,
        patch("tasks.video_cover.load_application", return_value=None),
    ):
        mock_connect.return_value.__enter__.return_value = MagicMock()
        result = process_video_cover(
            {
                "application_id": "11111111-1111-4111-8111-111111111111",
                "user_id": "22222222-2222-4222-8222-222222222222",
                "job_id": "33333333-3333-4333-8333-333333333333",
            }
        )
    assert result["status"] == "error"
    assert result["error"] == "application_not_found"


def test_ungrounded_hook_fails_validation():
    with pytest.raises(Exception):  # noqa: B017
        pack = validate_video_cover(
            {
                "script": (
                    "I invented a quantum compiler at FakeCorp last week. "
                    "I would welcome a conversation about the role at Nimbus."
                ),
                "hook": "I invented a quantum compiler at FakeCorp last week.",
                "close": "I would welcome a conversation about the role at Nimbus.",
                "chunk_ids": [CHUNK_A["id"]],
                "estimated_seconds": 30,
                "model_used": "test",
            }
        )
        assert_script_grounded(pack, [CHUNK_A])

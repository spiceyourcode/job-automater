"""P13.1 Interview prep — HG-9 STAR grounding tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from agents.interview_prep.graph import run_interview_prep
from agents.interview_prep.schema import assert_star_grounded, validate_prep
from tasks.interview_prep import InterviewPrepJob, process_interview_prep

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
    "requirements": "FastAPI PostgreSQL production",
    "salary_min": 12000000,
    "salary_max": 16000000,
    "salary_currency": "USD",
}


def test_heuristic_prep_is_grounded():
    pack = run_interview_prep(chunks=[CHUNK_A], job=JOB, profile={"salary_min": 11000000})
    assert pack is not None
    model = validate_prep(pack)
    assert_star_grounded(model, [CHUNK_A])
    assert model.negotiation.currency == "USD"
    assert model.negotiation.range_min_cents == 12000000
    assert isinstance(model.negotiation.target_cents, int) or model.negotiation.target_cents is None


def test_payload_rejects_extra_fields():
    with pytest.raises(ValidationError):
        InterviewPrepJob.model_validate(
            {
                "application_id": "11111111-1111-4111-8111-111111111111",
                "user_id": "22222222-2222-4222-8222-222222222222",
                "job_id": "33333333-3333-4333-8333-333333333333",
                "cv_text": "secret",
            }
        )


def test_process_skips_other_users_application():
    with (
        patch("tasks.interview_prep.connect") as mock_connect,
        patch("tasks.interview_prep.load_application", return_value=None),
    ):
        mock_connect.return_value.__enter__.return_value = MagicMock()
        result = process_interview_prep(
            {
                "application_id": "11111111-1111-4111-8111-111111111111",
                "user_id": "22222222-2222-4222-8222-222222222222",
                "job_id": "33333333-3333-4333-8333-333333333333",
            }
        )
    assert result["status"] == "error"
    assert result["error"] == "application_not_found"


def test_ungrounded_star_fails_validation():
    with pytest.raises(Exception):  # noqa: B017
        pack = validate_prep(
            {
                "questions": [
                    {
                        "question": "Why this company?",
                        "suggested_answer": "Because FastAPI at Acme Corp.",
                        "category": "company",
                        "chunk_ids": [CHUNK_A["id"]],
                    }
                ],
                "star_stories": [
                    {
                        "title": "Fake",
                        "situation": "I invented a unicorn IPO at FakeCorp.",
                        "task": "Invented quantum compilers overnight.",
                        "action": "Sold a made-up product to NASA.",
                        "result": "Became fictional CEO.",
                        "chunk_ids": [CHUNK_A["id"]],
                    }
                ],
                "negotiation": {
                    "currency": "USD",
                    "range_min_cents": 1,
                    "range_max_cents": 2,
                    "target_cents": 2,
                    "walkaway_cents": 1,
                    "talking_points": ["FastAPI"],
                    "chunk_ids": [CHUNK_A["id"]],
                },
                "model_used": "test",
            }
        )
        assert_star_grounded(pack, [CHUNK_A])

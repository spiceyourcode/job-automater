"""P3 GenerateDocs — HG-9 grounding tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from agents.generate_docs import run_generate_docs, validate_generated
from agents.generate_docs.schema import assert_grounded_in_chunks
from tasks.generate_docs import process_generate_docs

CHUNK_A = {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "content": "Built REST APIs with FastAPI and PostgreSQL at Acme Corp from 2020 to 2023.",
    "section_type": "experience",
    "chunk_index": 0,
}
CHUNK_B = {
    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "content": "Skills include Python, Docker, AWS, and Kubernetes for production systems.",
    "section_type": "skills",
    "chunk_index": 1,
}

JOB = {
    "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "title": "Senior Python Engineer",
    "company": "Nimbus",
    "description": "FastAPI role",
}


def test_generate_grounded_in_chunks():
    docs = run_generate_docs(
        chunks=[CHUNK_A, CHUNK_B],
        job=JOB,
        profile={"headline": "Backend Engineer"},
    )
    assert docs is not None
    validated = validate_generated(docs)
    assert_grounded_in_chunks(validated, [CHUNK_A, CHUNK_B])
    assert "TotallyFakeCorpXYZ" not in validated.tailored_cv


def test_rejects_ungrounded_bullet():
    docs = validate_generated(
        {
            "tailored_cv": (
                "# Me\n- Worked at TotallyFakeCorpXYZ as CEO inventing quantum"
            ),
            "cover_letter": (
                "Dear team,\n\nWorked at TotallyFakeCorpXYZ as CEO inventing quantum\n\nBye"
            ),
            "bullet_traces": [
                {
                    "text": "Worked at TotallyFakeCorpXYZ as CEO inventing quantum",
                    "chunk_id": CHUNK_A["id"],
                    "section": "experience",
                }
            ],
            "model_used": "test",
        }
    )
    with pytest.raises(ValueError, match="not grounded"):
        assert_grounded_in_chunks(docs, [CHUNK_A])


def test_process_never_saves_on_grounding_failure():
    user_id = "22222222-2222-2222-2222-222222222222"
    app_id = "11111111-1111-1111-1111-111111111111"
    job_id = "33333333-3333-3333-3333-333333333333"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.generate_docs.connect", return_value=mock_cm),
        patch(
            "tasks.generate_docs.load_application",
            return_value={"id": app_id, "job_id": job_id, "user_id": user_id},
        ),
        patch("tasks.generate_docs.load_job_for_user", return_value=JOB),
        patch(
            "tasks.generate_docs.load_cv_chunks_for_user",
            return_value=[CHUNK_A, CHUNK_B],
        ),
        patch("tasks.generate_docs.load_profile_for_user", return_value={}),
        patch("tasks.generate_docs.run_generate_docs", return_value=None),
        patch("tasks.generate_docs.save_application_documents") as save,
    ):
        result = process_generate_docs(
            {
                "application_id": app_id,
                "user_id": user_id,
                "job_id": job_id,
            }
        )

    assert result["status"] == "error"
    save.assert_not_called()


def test_process_saves_draft_when_grounded():
    user_id = "22222222-2222-2222-2222-222222222222"
    app_id = "11111111-1111-1111-1111-111111111111"
    job_id = "33333333-3333-3333-3333-333333333333"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    docs = run_generate_docs(chunks=[CHUNK_A, CHUNK_B], job=JOB, profile={})
    assert docs is not None

    with (
        patch("tasks.generate_docs.connect", return_value=mock_cm),
        patch(
            "tasks.generate_docs.load_application",
            return_value={"id": app_id, "job_id": job_id, "user_id": user_id},
        ),
        patch("tasks.generate_docs.load_job_for_user", return_value=JOB),
        patch(
            "tasks.generate_docs.load_cv_chunks_for_user",
            return_value=[CHUNK_A, CHUNK_B],
        ),
        patch("tasks.generate_docs.load_profile_for_user", return_value={}),
        patch("tasks.generate_docs.run_generate_docs", return_value=docs),
        patch("tasks.generate_docs.save_application_documents") as save,
    ):
        result = process_generate_docs(
            {
                "application_id": app_id,
                "user_id": user_id,
                "job_id": job_id,
            }
        )

    assert result["status"] == "ok"
    save.assert_called_once()

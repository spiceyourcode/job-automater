"""P2.3 extract_normalize — 10-fixture golden set + HG-9 validation gate."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agents.extract_normalize import run_extract_normalize, validate_normalized
from agents.extract_normalize.schema import NormalizedJob
from tasks.normalize_jobs import process_normalize_jobs

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLES = json.loads((FIXTURES / "normalize_samples.json").read_text(encoding="utf-8"))


def test_ten_fixtures_schema_valid_rate():
    """GOAL: >95% schema-valid extractions on fixture set."""
    assert len(SAMPLES) == 10
    ok = 0
    for sample in SAMPLES:
        job = run_extract_normalize(
            raw_data=sample["raw_data"],
            source_type=sample["source_type"],
            source_external_id=sample.get("source_external_id"),
            source_url=sample.get("source_url"),
            use_llm=False,
        )
        if job is not None:
            ok += 1
            assert "title" in job.field_confidence
            assert "company" in job.field_confidence
            assert isinstance(job, NormalizedJob)
    rate = ok / len(SAMPLES)
    assert rate >= 0.95, f"valid rate {rate:.0%} < 95% ({ok}/{len(SAMPLES)})"


def test_invalid_llm_refine_falls_back_to_heuristic():
    """P12.5.3: extra/invalid LLM keys must not drop a schema-valid heuristic job."""
    sample = SAMPLES[0]
    with (
        patch("agents.extract_normalize.graph.has_chat_provider", return_value=True),
        patch("agents.extract_normalize.llm.llm_refine") as refine,
    ):
        refine.return_value = {
            "title": "X",
            "company": "Y",
            "source": "api",
        }
        job = run_extract_normalize(
            raw_data=sample["raw_data"],
            source_type=sample["source_type"],
            source_external_id=sample.get("source_external_id"),
            source_url=sample.get("source_url"),
            use_llm=True,
        )
    assert job is not None
    assert job.title != "X"


def test_rejects_unvalidated_llm_shaped_payload():
    """HG-9: garbage without confidence must not validate."""
    with pytest.raises(Exception):
        validate_normalized(
            {
                "title": "X",
                "company": "Y",
                "source": "rss",
                # missing field_confidence
            }
        )


def test_salary_must_be_integer_cents():
    with pytest.raises(Exception):
        validate_normalized(
            {
                "title": "Eng",
                "company": "Co",
                "source": "api",
                "salary_min": -1,
                "field_confidence": {"title": 0.9, "company": 0.9},
            }
        )


def test_playwright_raw_keeps_snippet_as_description():
    from agents.extract_normalize.heuristic import extract_heuristic

    draft = extract_heuristic(
        {
            "format": "playwright",
            "title": "Backend Engineer",
            "url": "https://example.com/jobs/1",
            "location": "Remote",
            "department": "Engineering",
            "snippet": "Build APIs with Python and FastAPI. Remote friendly.",
        },
        source_type="playwright",
        source_external_id="abc",
        source_url="https://example.com/jobs/1",
    )
    assert draft["description"]
    assert "FastAPI" in draft["description"]
    assert "python" in draft["tags"]
    assert draft["location"] == "Remote"


def test_process_normalize_never_inserts_on_validation_failure():
    user_id = "22222222-2222-2222-2222-222222222222"
    raw_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.normalize_jobs.connect", return_value=mock_cm),
        patch(
            "tasks.normalize_jobs.load_jobs_raw",
            return_value=[
                {
                    "id": raw_id,
                    "user_id": user_id,
                    "source_config_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                    "source_id": "x",
                    "source_url": None,
                    "raw_data": {"format": "rss"},  # no title → may still produce Untitled
                    "processed": False,
                    "source_type": "rss",
                }
            ],
        ),
        patch(
            "tasks.normalize_jobs.run_extract_normalize",
            return_value=None,
        ),
        patch("tasks.normalize_jobs.insert_normalized_job") as insert,
        patch("tasks.normalize_jobs.mark_jobs_raw_processed") as mark,
    ):
        result = process_normalize_jobs({"job_ids": [raw_id], "user_id": user_id})

    assert result["failed"] == 1
    insert.assert_not_called()
    mark.assert_called_once()
    assert mark.call_args.kwargs.get("error") or mark.call_args[1].get("error")


def test_process_normalize_inserts_only_validated():
    from agents.extract_normalize.schema import NormalizedJob

    user_id = "22222222-2222-2222-2222-222222222222"
    raw_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    validated = NormalizedJob.model_validate(
        {
            "title": "Backend Engineer",
            "company": "Nimbus",
            "source": "api",
            "source_id": "42",
            "field_confidence": {"title": 0.98, "company": 0.95},
        }
    )

    with (
        patch("tasks.normalize_jobs.connect", return_value=mock_cm),
        patch(
            "tasks.normalize_jobs.load_jobs_raw",
            return_value=[
                {
                    "id": raw_id,
                    "user_id": user_id,
                    "source_config_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                    "source_id": "42",
                    "source_url": "https://x",
                    "raw_data": {"format": "api", "item": {"title": "Backend Engineer"}},
                    "processed": False,
                    "source_type": "api",
                }
            ],
        ),
        patch("tasks.normalize_jobs.run_extract_normalize", return_value=validated),
        patch("tasks.normalize_jobs.insert_normalized_job", return_value="job-1") as insert,
        patch("tasks.normalize_jobs.mark_jobs_raw_processed") as mark,
        patch("tasks.match_score.match_score") as match_task,
        patch("tasks.enrich_company.enrich_company") as enrich_task,
    ):
        result = process_normalize_jobs({"job_ids": [raw_id], "user_id": user_id})

    assert result["normalized"] == 1
    insert.assert_called_once()
    mark.assert_called_once_with(mock_conn, jobs_raw_id=raw_id, error=None)
    match_task.delay.assert_called_once()

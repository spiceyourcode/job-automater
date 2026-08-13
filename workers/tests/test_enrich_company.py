"""Tests for optional company enrichment heuristics."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from tasks.enrich_company import (
    domain_from_url,
    guess_industry,
    guess_size,
    process_enrich_company,
)


def test_domain_from_url_strips_www() -> None:
    assert domain_from_url("https://www.acme.dev/jobs/1") == "acme.dev"


def test_domain_from_url_skips_job_boards() -> None:
    assert domain_from_url("https://linkedin.com/jobs/view/1") is None


def test_guess_size_and_industry() -> None:
    assert guess_size("Acme Corp") == "enterprise"
    assert guess_industry("Senior ML Engineer", ["python"]) == "AI / Data"


def test_process_enrich_company_user_scoped() -> None:
    user_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    job_id = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [
        {
            "id": job_id,
            "company": "Acme Labs",
            "title": "Backend Engineer",
            "tags": ["api"],
            "application_url": "https://jobs.acme.io/1",
            "source_url": None,
            "company_domain": None,
        }
    ]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn

    with patch("tasks.enrich_company.connect", return_value=mock_cm):
        result = process_enrich_company({"user_id": user_id, "job_ids": [job_id]})

    assert result["status"] == "ok"
    assert result["enriched"] == 1
    # UPDATE must include user_id (IDOR)
    update_call = mock_cur.execute.call_args_list[-1]
    assert "user_id" in update_call[0][0]
    assert user_id in update_call[0][1]

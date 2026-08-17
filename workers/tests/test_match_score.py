"""P2.4 MatchScore + dedup tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from agents.match_score.dedup import is_fuzzy_duplicate
from agents.match_score.schema import validate_match_score
from agents.match_score.scoring import compute_match_score
from tasks.match_score import process_match_score

# Known strong pair — verify overall > 85
STRONG_PROFILE = {
    "years_experience": 7,
    "technical_skills": [
        {"name": "Python"},
        {"name": "FastAPI"},
        {"name": "PostgreSQL"},
        {"name": "AWS"},
        {"name": "Docker"},
    ],
    "soft_skills": ["collaboration"],
    "preferred_locations": ["Remote", "Berlin"],
    "salary_min": 12_000_000,  # $120k in cents
    "salary_max": 18_000_000,
    "salary_currency": "USD",
    "employment_types": ["full-time"],
    "willing_to_relocate": False,
}

STRONG_JOB = {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "title": "Senior Python Engineer",
    "company": "Acme",
    "location": "Remote",
    "is_remote": True,
    "remote_type": "fully_remote",
    "employment_type": "full-time",
    "experience_level": "senior",
    "salary_min": 14_000_000,
    "salary_max": 16_000_000,
    "description": "Build APIs with FastAPI, PostgreSQL, AWS, and Docker. Collaboration matters.",
    "tags": ["python", "fastapi", "postgresql", "aws", "docker"],
    "keywords": ["python", "fastapi"],
    "tech_stack": [],
    "is_duplicate": False,
}


def test_strong_pair_scores_above_85():
    result = compute_match_score(STRONG_PROFILE, STRONG_JOB)
    validated = validate_match_score(result)
    assert validated.overall_score > 85
    assert len(validated.reasoning) >= 20
    assert validated.weights["skills"] == 0.40


def test_sparse_job_not_stuck_near_74():
    """Missing JD used to push every remote job to ~74 via neutral defaults."""
    sparse = {
        "title": "Account Executive",
        "company": "Acme",
        "location": None,
        "is_remote": True,
        "remote_type": "fully_remote",
        "employment_type": None,
        "experience_level": None,
        "salary_min": None,
        "salary_max": None,
        "description": None,
        "tags": [],
        "keywords": [],
        "tech_stack": [],
    }
    thin_profile = {
        "years_experience": 7,
        "technical_skills": [{"name": "Python"}, {"name": "FastAPI"}],
        "preferred_locations": [],
        "salary_min": None,
        "salary_max": None,
        "employment_types": ["full-time"],
    }
    result = compute_match_score(thin_profile, sparse)
    assert result["skill_match"] < 70
    assert result["overall_score"] < 70
    assert abs(result["overall_score"] - 74) > 3


def test_score_without_reasoning_rejected():
    bad = compute_match_score(STRONG_PROFILE, STRONG_JOB)
    bad["reasoning"] = "short"
    with pytest.raises(Exception):
        validate_match_score(bad)


def test_fuzzy_dedup_near_titles():
    a = {
        "title": "Senior Python Engineer",
        "company": "Acme Corp",
        "location": "Remote",
    }
    b = {
        "title": "Senior Python Engineer",
        "company": "Acme Corp",
        "location": "Remote",
    }
    c = {
        "title": "Junior Java Developer",
        "company": "Other Co",
        "location": "NYC",
    }
    assert is_fuzzy_duplicate(a, b) is True
    assert is_fuzzy_duplicate(a, c) is False


def test_process_skips_other_users_jobs_idor():
    user_id = "22222222-2222-2222-2222-222222222222"
    other_job = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    with (
        patch("tasks.match_score.connect", return_value=mock_cm),
        patch(
            "tasks.match_score.load_profile_for_user",
            return_value=STRONG_PROFILE,
        ),
        # Owned jobs empty → IDOR / missing
        patch("tasks.match_score.load_jobs_for_user", return_value=[]),
        patch("tasks.match_score.upsert_job_score") as upsert,
        patch("tasks.match_score.mark_job_duplicate") as dup,
    ):
        result = process_match_score(
            {"job_ids": [other_job], "user_id": user_id}
        )

    assert result["skipped"] == 1
    assert result["scored"] == 0
    upsert.assert_not_called()
    dup.assert_not_called()


def test_process_scores_owned_job():
    user_id = "22222222-2222-2222-2222-222222222222"
    job_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    owned = [{**STRONG_JOB, "user_id": user_id, "id": job_id}]

    with (
        patch("tasks.match_score.connect", return_value=mock_cm),
        patch("tasks.match_score.load_profile_for_user", return_value=STRONG_PROFILE),
        patch(
            "tasks.match_score.load_jobs_for_user",
            side_effect=[owned, owned],
        ),
        patch("tasks.match_score.upsert_job_score", return_value="score-1") as upsert,
        patch("tasks.match_score.mark_job_scored") as marked,
        patch("tasks.match_score.mark_job_duplicate") as dup,
    ):
        result = process_match_score({"job_ids": [job_id], "user_id": user_id})

    assert result["scored"] == 1
    upsert.assert_called_once()
    kwargs = upsert.call_args.kwargs
    assert kwargs["user_id"] == user_id
    assert kwargs["job_id"] == job_id
    assert len(kwargs["score"]["reasoning"]) >= 20
    assert kwargs["score"]["overall_score"] > 85
    marked.assert_called_once()
    dup.assert_not_called()


def test_duplicate_marked_not_scored():
    user_id = "22222222-2222-2222-2222-222222222222"
    job_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    peer_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    mock_conn = MagicMock()
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_conn
    mock_cm.__exit__.return_value = False

    candidate = {**STRONG_JOB, "id": job_id, "user_id": user_id}
    peer = {
        **STRONG_JOB,
        "id": peer_id,
        "user_id": user_id,
        "is_duplicate": False,
    }

    with (
        patch("tasks.match_score.connect", return_value=mock_cm),
        patch("tasks.match_score.load_profile_for_user", return_value=STRONG_PROFILE),
        patch(
            "tasks.match_score.load_jobs_for_user",
            side_effect=[[candidate], [candidate, peer]],
        ),
        patch("tasks.match_score.upsert_job_score") as upsert,
        patch("tasks.match_score.mark_job_duplicate") as dup,
    ):
        result = process_match_score({"job_ids": [job_id], "user_id": user_id})

    assert result["duplicated"] == 1
    assert result["scored"] == 0
    upsert.assert_not_called()
    dup.assert_called_once()

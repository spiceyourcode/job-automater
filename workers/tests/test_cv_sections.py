"""Unit tests for classify_cv_section."""

from __future__ import annotations

from agents.generate_docs.sections import classify_cv_section, resolve_chunk_section


def test_heading_education():
    assert classify_cv_section("Education\nB.S. Computer Science, MIT, 2018") == "education"


def test_heading_skills():
    assert classify_cv_section("Skills\nPython, Docker, AWS") == "skills"


def test_heading_experience():
    assert classify_cv_section("Work Experience\nEngineer at Acme") == "experience"


def test_heading_summary():
    assert classify_cv_section("Professional Summary\nBackend engineer with seven years") == "summary"


def test_heading_projects():
    assert classify_cv_section("Projects\nJobAutomater — Celery + Hono") == "projects"


def test_heading_certifications():
    assert classify_cv_section("Certifications\nAWS Solutions Architect — 2023") == "certifications"


def test_heading_languages():
    assert classify_cv_section("Languages\nEnglish: Fluent") == "languages"


def test_stored_section_type_wins_over_body_content():
    assert (
        classify_cv_section(
            "Some paragraph without a heading about APIs",
            stored_section_type="skills",
        )
        == "skills"
    )


def test_body_stored_still_classifies_from_heading():
    assert (
        classify_cv_section(
            "Education\nUniversity of Nairobi, BSc",
            stored_section_type="body",
        )
        == "education"
    )


def test_resolve_chunk_maps_body_to_experience():
    section = resolve_chunk_section(
        {
            "id": "x",
            "content": "Built REST APIs with FastAPI at Acme Corp from 2020 to 2023.",
            "section_type": "body",
        }
    )
    assert section == "experience"


def test_content_heuristic_education():
    assert (
        classify_cv_section(
            "Bachelor of Science in Computer Science, University of Nairobi, 2019"
        )
        == "education"
    )

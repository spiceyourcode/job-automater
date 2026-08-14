"""P9.1 template layouts — layout only; HG-9 grounding preserved."""

from __future__ import annotations

from agents.generate_docs import run_generate_docs, validate_generated
from agents.generate_docs.schema import assert_grounded_in_chunks
from agents.generate_docs.templates import render_cv, render_cover_letter

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
}


def test_each_template_stays_grounded():
    for tmpl in ("modern", "classic", "minimal"):
        docs = run_generate_docs(
            chunks=[CHUNK_A, CHUNK_B],
            job=JOB,
            profile={"headline": "Backend Engineer"},
            cv_template=tmpl,
            cl_template=tmpl,
        )
        assert docs is not None, tmpl
        validated = validate_generated(docs)
        assert_grounded_in_chunks(validated, [CHUNK_A, CHUNK_B])
        assert "TotallyFakeCorpXYZ" not in validated.tailored_cv
        assert "FastAPI" in validated.tailored_cv


def test_templates_differ_in_layout():
    modern = render_cv(
        template="modern",
        name="Ada",
        job_title="Engineer",
        company="Nimbus",
        experience_bullets=["Relevant to Engineer: Built REST APIs"],
        skills=["Python"],
    )
    classic = render_cv(
        template="classic",
        name="Ada",
        job_title="Engineer",
        company="Nimbus",
        experience_bullets=["Relevant to Engineer: Built REST APIs"],
        skills=["Python"],
    )
    minimal = render_cv(
        template="minimal",
        name="Ada",
        job_title="Engineer",
        company="Nimbus",
        experience_bullets=["Relevant to Engineer: Built REST APIs"],
        skills=["Python"],
    )
    assert "## Experience highlights" in modern
    assert "EXPERIENCE" in classic
    assert "• Relevant to Engineer: Built REST APIs" in minimal
    assert modern != classic != minimal


def test_cover_letter_templates_preserve_bullets():
    lead = "Relevant to Engineer: Built REST APIs with FastAPI"
    support = "Skills include Python, Docker, AWS"
    for tmpl in ("modern", "classic", "minimal"):
        cl = render_cover_letter(
            template=tmpl,
            name="Ada",
            job_title="Engineer",
            company="Nimbus",
            lead=lead,
            support=support,
        )
        assert lead in cl
        assert support in cl

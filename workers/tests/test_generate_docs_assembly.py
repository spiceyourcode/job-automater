"""P9.5 document assembler — structured sections + auto-accepted traces."""

from __future__ import annotations

from agents.generate_docs.assemble import assemble_sections, format_contact_lines
from agents.generate_docs.heuristic import generate_from_chunks
from agents.generate_docs.schema import assert_grounded_in_chunks, validate_generated

FRANKLINE_CHUNKS = [
    {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "section_type": "body",
        "content": (
            "Frankline Omari\nfranklineomari@gmail.com +254792873281 Nakuru\n"
            "● CyberTalents Cybersecurity |CyberTalents\n"
            "● Fundamentals of Generative AI - Microsoft Jun 2024\n"
            "● Fundamentals of Machine Learning - Microsoft Jun 2024\n"
        ),
    },
    {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "section_type": "projects",
        "content": (
            "Online Shop - E-Commerce API Platform\n"
            "Repo: https://github.com/spiceyourcode/Online-shop\n"
            "Django REST backend with product catalogue, authentication, cart, "
            "and order management APIs.\n"
            "PostgreSQL-backed service layer with REST endpoints for checkout."
        ),
    },
    {
        "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "section_type": "experience",
        "content": (
            "Software engineer with 3 years of experience designing and building "
            "secure backend services and REST APIs for healthcare and e-commerce."
        ),
    },
]

JOB = {
    "title": "ICT MANAGER",
    "company": "Brites Management Services Limited",
    "description": "ICT leadership, backend APIs, PostgreSQL, integrations.",
    "requirements": "REST PostgreSQL Django leadership",
}

PROFILE = {
    "preferred_locations": [
        {"city": "Nakuru", "country": "Kenya", "remoteOk": True},
    ],
}

CONTACT = {"name": "Frankline Omari", "email": "franklineomari@gmail.com"}


def test_format_contact_skips_json_blob():
    lines = format_contact_lines(PROFILE, CONTACT)
    assert any("franklineomari@gmail.com" in ln for ln in lines)
    assert any("Nakuru" in ln for ln in lines)
    assert not any("remoteOk" in ln and "{" in ln for ln in lines)


def test_assembler_puts_certs_separate_from_experience():
    sections, traces, _ = assemble_sections(chunks=FRANKLINE_CHUNKS, job=JOB)
    exp = " ".join(sections.get("experience") or []).lower()
    assert "fundamentals of generative" not in exp
    assert sections.get("certifications")
    assert all(t["status"] == "accepted" for t in traces)
    assert len(traces) <= 25


def test_cover_letter_not_cert_only():
    docs = generate_from_chunks(
        chunks=FRANKLINE_CHUNKS,
        job=JOB,
        profile=PROFILE,
        contact=CONTACT,
    )
    pack = validate_generated(docs)
    assert_grounded_in_chunks(pack, FRANKLINE_CHUNKS)
    assert "CyberTalents" not in pack.cover_letter or "Django" in pack.cover_letter
    assert "●" not in pack.cover_letter
    assert "fundamentals of generative" not in pack.tailored_cv.lower().split("work experience")[0]

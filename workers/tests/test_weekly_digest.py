"""P11.6 weekly digest — no CV or email bodies in the message."""

from datetime import datetime, timezone

from tasks.weekly_digest import (
    DigestStats,
    MatchLine,
    is_digest_hour,
    render_digest,
)


def test_render_digest_has_counts_not_bodies() -> None:
    text = render_digest(
        DigestStats(
            top_matches=[
                MatchLine(company="Acme", title="Backend Engineer", score=91)
            ],
            applications_submitted=4,
            responses=2,
            interviews=1,
            offers=0,
        )
    )
    assert "Applications submitted: 4" in text
    assert "Acme" in text
    assert "Backend Engineer" in text
    assert "body_text" not in text
    assert "tailored_cv" not in text
    assert "cover_letter" not in text
    assert "SECRET" not in text


def test_render_cannot_embed_cv_or_email_fields() -> None:
    """Even if a match title were weird, renderer has no body slot."""
    text = render_digest(
        DigestStats(
            top_matches=[],
            applications_submitted=0,
            responses=0,
            interviews=0,
            offers=0,
        )
    )
    for banned in (
        "body_text",
        "snippet",
        "tailored_cv_content",
        "cover_letter_content",
        "<html>",
    ):
        assert banned not in text


def test_digest_hour_monday_8_local() -> None:
    # 2026-08-10 is a Monday; 05:00 UTC = 08:00 Europe/Helsinki (UTC+3 in August)
    now = datetime(2026, 8, 10, 5, 15, tzinfo=timezone.utc)
    assert is_digest_hour(now, "Europe/Helsinki")
    assert not is_digest_hour(now, "UTC")
    tuesday = datetime(2026, 8, 11, 8, 0, tzinfo=timezone.utc)
    assert not is_digest_hour(tuesday, "UTC")

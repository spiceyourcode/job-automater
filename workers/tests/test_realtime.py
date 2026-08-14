"""Isolation tests for user-scoped WS channels (P11.5 FAILURE)."""

from tasks.realtime import user_channel, _strip_pii


def test_channel_is_per_user() -> None:
    assert user_channel("user-a") != user_channel("user-b")
    assert user_channel("user-a") == "jobautomater:ws:user-a"


def test_strip_pii_drops_email_and_cv() -> None:
    cleaned = _strip_pii(
        {
            "type": "notification",
            "title": "Interview",
            "body_text": "SECRET EMAIL",
            "tailored_cv": "SECRET CV",
        }
    )
    assert cleaned["type"] == "notification"
    assert "body_text" not in cleaned
    assert "tailored_cv" not in cleaned
    assert "SECRET" not in json_dump(cleaned)


def json_dump(obj: dict) -> str:
    import json

    return json.dumps(obj)

"""IMAP login errors must not leak mailbox secrets (HG-8)."""

from __future__ import annotations

from collectors.imap import ImapAuthError, public_imap_login_error


def test_gmail_auth_failed_maps_to_app_password_hint():
    err = public_imap_login_error(
        Exception("b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)'"),
        "imap.gmail.com",
    )
    assert isinstance(err, ImapAuthError)
    assert "App Password" in str(err)
    assert "Invalid credentials" not in str(err)


def test_gmail_app_password_alert_maps_safely():
    err = public_imap_login_error(
        Exception(
            "b'[ALERT] Application-specific password required: https://support.google.com/accounts/answer/185833 (Failure)'"
        ),
        "imap.googlemail.com",
    )
    assert isinstance(err, ImapAuthError)
    assert "Connect Gmail" in str(err)


def test_non_gmail_auth_is_generic():
    err = public_imap_login_error(
        Exception("AUTHENTICATIONFAILED"),
        "imap.fastmail.com",
    )
    assert isinstance(err, ImapAuthError)
    assert "mailbox secret" in str(err)


def test_unrelated_error_passes_through():
    original = RuntimeError("Cannot select folder INBOX")
    assert public_imap_login_error(original, "imap.gmail.com") is original

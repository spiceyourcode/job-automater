"""Collector failure strings must not include secrets (HG-8)."""

from __future__ import annotations

from collectors.imap import ImapAuthError
from tasks.collect_source import _sanitize_error


def test_authenticationfailed_is_auth_failed_not_raw_imap():
    err = _sanitize_error(
        Exception("b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)'")
    )
    assert err.endswith("[auth_failed]")
    assert "Invalid credentials" not in err


def test_imap_auth_error_kept_as_public_hint():
    msg = (
        "Gmail IMAP rejected this login. Use a Google App Password "
        "(2-Step Verification on), not your account password."
    )
    err = _sanitize_error(ImapAuthError(msg))
    assert err == msg


def test_token_in_message_is_redacted():
    err = _sanitize_error(Exception("bearer token leaked"))
    assert err.endswith("[redacted]")

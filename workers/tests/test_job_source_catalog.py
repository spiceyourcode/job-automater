"""Smoke test: job source catalog JSON matches collector config shapes."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

CATALOG_PATH = (
    Path(__file__).resolve().parents[2]
    / "api"
    / "src"
    / "modules"
    / "sources"
    / "job-source-catalog.json"
)

REQUIRED_BY_TYPE: dict[str, set[str]] = {
    "rss": {"feedUrl"},
    "api": {"baseUrl"},
    "imap": {"imapServer", "username", "password"},
    "career_page": {"baseUrl", "jobCardSelector", "titleSelector"},
    "playwright": {"startUrl", "jobCardSelector", "titleSelector"},
    "telegram": {"botToken", "channelId"},
    "whatsapp": {"exportPath"},
}


def test_catalog_file_exists_and_entries_valid() -> None:
    raw = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries = raw.get("entries")
    assert isinstance(entries, list)
    assert len(entries) >= 15
    ids = {e["id"] for e in entries}
    assert len(ids) == len(entries)
    for entry in entries:
        source_type = entry["sourceType"]
        assert source_type in REQUIRED_BY_TYPE
        user_fields = set(entry.get("userFields") or [])
        config = entry.get("config") or {}
        needed = REQUIRED_BY_TYPE[source_type] - user_fields
        missing = needed - set(config.keys())
        assert not missing, f"{entry['id']} missing config keys: {missing}"

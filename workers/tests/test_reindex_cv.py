"""Tests for CV rechunk helpers — never asserts on PII log contents."""

from __future__ import annotations

from unittest.mock import MagicMock

from agents.cv_reindex.rechunk import reindex_document, split_paragraphs


def test_split_paragraphs_empty():
    assert split_paragraphs("") == []
    assert split_paragraphs("   ") == []


def test_split_paragraphs_blocks():
    text = "Hello world.\n\nSecond block."
    assert split_paragraphs(text) == ["Hello world.", "Second block."]


def test_reindex_document_deletes_then_inserts():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.return_value = {
        "id": "cv-1",
        "user_id": "u-1",
        "parsed_text": "Alpha.\n\nBeta.",
        "chunk_count": 0,
    }

    result = reindex_document(conn, "u-1", "cv-1")
    assert result["status"] == "ok"
    assert result["chunk_count"] == 2

    executed = [call.args[0] for call in cur.execute.call_args_list]
    assert any("DELETE FROM cv_chunks" in sql for sql in executed)
    assert sum(1 for sql in executed if "INSERT INTO cv_chunks" in sql) == 2


def test_reindex_document_empty_parsed_text():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.return_value = {
        "id": "cv-1",
        "user_id": "u-1",
        "parsed_text": "",
        "chunk_count": 0,
    }

    result = reindex_document(conn, "u-1", "cv-1")
    assert result["status"] == "error"
    assert result["error"] == "empty_parsed_text"
    assert result["chunk_count"] == 0
    executed = [call.args[0] for call in cur.execute.call_args_list]
    assert not any("INSERT INTO cv_chunks" in sql for sql in executed)


def test_reindex_document_missing():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    cur.fetchone.return_value = None
    result = reindex_document(conn, "u-1", "missing")
    assert result["status"] == "error"

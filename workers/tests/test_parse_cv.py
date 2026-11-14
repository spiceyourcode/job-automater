from __future__ import annotations

import importlib
import sys
import types
from unittest.mock import MagicMock, patch


def _load_parse_cv():
    for name in list(sys.modules):
        if name == "tasks.parse_cv" or name.startswith("tasks.parse_cv."):
            del sys.modules[name]

    fake_db = types.ModuleType("db")

    def _connect():
        return MagicMock()

    fake_db.connect = _connect
    sys.modules["db"] = fake_db

    return importlib.import_module("tasks.parse_cv").parse_cv


def test_parse_cv_updates_and_chains_reindex():
    parse_cv = _load_parse_cv()

    doc = {
        "id": "cv-1",
        "user_id": "u-1",
        "file_url": "cvs/u-1/x/cv.pdf",
        "mime_type": "application/pdf",
        "original_filename": "cv.pdf",
    }
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cur)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cur.fetchone.return_value = doc

    mod = sys.modules["tasks.parse_cv"]
    with (
        patch.object(mod, "connect") as mock_connect,
        patch.object(mod, "download_bytes", return_value=b"%PDF"),
        patch.object(mod, "extract_pdf_with_indra", return_value="A" * 80),
        patch("tasks.reindex_cv.reindex_cv") as mock_reindex,
    ):
        mock_connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_connect.return_value.__exit__ = MagicMock(return_value=False)

        result = parse_cv({"user_id": "u-1", "cv_document_id": "cv-1", "task_id": "t-1"})

    assert result["status"] == "ok"
    mock_reindex.delay.assert_called_once()
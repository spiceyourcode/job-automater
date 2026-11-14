from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from lib.cv_extract import (
    CvExtractError,
    extract_pdf_with_indra,
    normalize_cv_text,
    reset_converter_for_tests,
)


def test_normalize_cv_text():
    assert normalize_cv_text("a\r\n\r\n\n  b") == "a\n\n  b"


def test_extract_pdf_with_indra_combines_pages():
    reset_converter_for_tests()
    page_ok = MagicMock(
        source="ocr",
        markdown="Senior Software Engineer at Acme Corp with ten years experience",
    )
    page_err = MagicMock(source="error", markdown="")

    mock_converter = MagicMock()
    mock_converter.convert.return_value = [(0, page_ok), (1, page_err)]

    with patch("lib.cv_extract._get_converter", return_value=mock_converter):
        text = extract_pdf_with_indra(b"%PDF-fake", max_pages=5)

    assert "Senior Software Engineer" in text
    mock_converter.convert.assert_called_once()


def test_extract_pdf_too_short():
    reset_converter_for_tests()
    page = MagicMock(source="ocr", markdown="hi")
    mock_converter = MagicMock()
    mock_converter.convert.return_value = [(0, page)]

    with patch("lib.cv_extract._get_converter", return_value=mock_converter):
        with pytest.raises(CvExtractError):
            extract_pdf_with_indra(b"%PDF-fake")
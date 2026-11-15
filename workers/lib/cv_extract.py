"""CV PDF text extraction via Indra OCR — worker fallback for scanned PDFs (HG-8/HG-9)."""

from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)

MIN_CV_TEXT_LEN = 40
DEFAULT_MAX_PAGES = 30

_converter = None


class CvExtractError(Exception):
    pass


def normalize_cv_text(text: str) -> str:
    normalized = (
        text.replace("\r\n", "\n").replace("\u0000", "").replace("\t", " ")
    )
    normalized = re.sub(r"[ \t]+\n", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _get_converter():
    global _converter                 
    if _converter is not None:
        return _converter
    import indra_ocr

    threads = max(1, indra_ocr.usable_cores())
    _converter = indra_ocr.load(mode="auto", image_ocr=True, threads=threads)
    return _converter


def extract_pdf_with_indra(
    data: bytes,
    *,
    max_pages: int = DEFAULT_MAX_PAGES,
) -> str:
    if not data:
        raise CvExtractError("empty_pdf")
    if TYPE_CHECKING:
        pass
    path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            path = Path(tmp.name)
        converter = _get_converter()
        parts: list[str] = []
        errors = 0
        for page_idx, page in converter.convert(str(path), max_pages=max_pages):
            if page.source == "error":
                errors += 1
                logger.warning("indra_ocr_page_error page=%s", page_idx)
                continue
            md = (page.markdown or "").strip()
            if md:
                parts.append(md)
        raw = "\n\n".join(parts)
        text = normalize_cv_text(raw)
        if len(text) < MIN_CV_TEXT_LEN:
            raise CvExtractError(
                "extracted text too short — scan quality may be too low"
            )
        logger.info(
            "indra_ocr_ok pages=%s error_pages=%s chars=%s",
            len(parts),
            errors,
            len(text),
        )
        return text
    except CvExtractError:
        raise
    except Exception as exc:
        raise CvExtractError("could not extract text from pdf") from exc
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


def reset_converter_for_tests() -> None:
    global _converter                 
    _converter = None
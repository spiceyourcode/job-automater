"""Heuristic extractor — deterministic path for structured collector payloads."""

from __future__ import annotations

import re
from html import unescape
from typing import Any

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_SALARY_RE = re.compile(
    r"\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*k?(?:\s*[-–—to]+\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*k?)?",
    re.I,
)
_REMOTE_RE = re.compile(r"\b(remote|work from home|wfh|hybrid|onsite|on-site)\b", re.I)
_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_TECH = (
    "python",
    "typescript",
    "javascript",
    "react",
    "node",
    "fastapi",
    "django",
    "postgresql",
    "postgres",
    "aws",
    "kubernetes",
    "docker",
    "go",
    "rust",
    "java",
    "sql",
    "redis",
    "graphql",
)


def _strip_html(text: str) -> str:
    return _WS_RE.sub(" ", unescape(_TAG_RE.sub(" ", text))).strip()


def _parse_salary_cents(blob: str) -> tuple[int | None, int | None]:
    """Best-effort yearly USD dollars → cents. Returns (min, max) or (None, None)."""
    m = _SALARY_RE.search(blob)
    if not m:
        return None, None

    def to_cents(raw: str, had_k: bool) -> int:
        n = float(raw.replace(",", ""))
        if had_k or n < 1000:
            # treat small numbers / trailing k as thousands of dollars
            if "k" in blob[m.start() : m.end()].lower() or n < 1000:
                n *= 1000
        return int(n * 100)

    # Re-check k in matched span
    span = blob[m.start() : m.end()].lower()
    lo = to_cents(m.group(1), "k" in span)
    hi = to_cents(m.group(2), "k" in span) if m.group(2) else None
    # Guard absurd values
    if lo and lo > 10_000_000_00:  # > $10M
        return None, None
    return lo, hi


def _remote_flags(blob: str) -> tuple[bool, str | None]:
    m = _REMOTE_RE.search(blob)
    if not m:
        return False, None
    token = m.group(1).lower()
    if token in ("remote", "work from home", "wfh"):
        return True, "fully_remote"
    if token == "hybrid":
        return True, "hybrid"
    if token in ("onsite", "on-site"):
        return False, "onsite"
    return False, None


def _tags_from_text(blob: str) -> list[str]:
    lower = blob.lower()
    found = [t for t in _TECH if t in lower]
    # normalize postgres → postgresql
    out: list[str] = []
    for t in found:
        if t == "postgres":
            t = "postgresql"
        if t not in out:
            out.append(t)
    return out


def extract_heuristic(
    raw_data: dict[str, Any],
    *,
    source_type: str,
    source_external_id: str | None,
    source_url: str | None,
) -> dict[str, Any]:
    """
    Build a draft NormalizedJob dict from collector raw_data.
    Always includes field_confidence for title/company.
    """
    fmt = str(raw_data.get("format") or source_type)

    title = ""
    company = "Unknown"
    description = ""
    application_url = source_url
    conf: dict[str, float] = {}

    if fmt == "rss" or "title" in raw_data and "link" in raw_data:
        title = str(raw_data.get("title") or "").strip()
        description = _strip_html(str(raw_data.get("description") or raw_data.get("summary") or ""))
        application_url = str(raw_data.get("link") or source_url or "") or source_url
        conf["title"] = 0.95 if title else 0.1
        conf["company"] = 0.4
        # Try "Role at Company" / "Company: Role"
        if " at " in title:
            parts = title.rsplit(" at ", 1)
            if len(parts) == 2 and parts[1].strip():
                title, company = parts[0].strip(), parts[1].strip()
                conf["company"] = 0.75
        conf["description"] = 0.85 if description else 0.2

    elif fmt == "api" or "item" in raw_data:
        item = raw_data.get("item") if isinstance(raw_data.get("item"), dict) else raw_data
        assert isinstance(item, dict)
        title = str(item.get("title") or item.get("role") or item.get("name") or "").strip()
        company = str(item.get("company") or item.get("org") or item.get("employer") or "Unknown").strip()
        description = _strip_html(
            str(item.get("description") or item.get("body") or item.get("summary") or "")
        )
        application_url = (
            str(item.get("url") or item.get("applyUrl") or item.get("apply_url") or source_url or "")
            or source_url
        )
        location = item.get("location")
        conf["title"] = 0.98 if title else 0.1
        conf["company"] = 0.95 if company and company != "Unknown" else 0.3
        conf["description"] = 0.9 if description else 0.2
        is_remote, remote_type = _remote_flags(f"{title} {description} {location or ''}")
        salary_min, salary_max = _parse_salary_cents(description)
        tags = _tags_from_text(f"{title} {description}")
        draft: dict[str, Any] = {
            "title": title or "Untitled role",
            "company": company or "Unknown",
            "location": str(location) if location else None,
            "is_remote": is_remote,
            "remote_type": remote_type,
            "description": description or None,
            "application_url": application_url,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "USD",
            "tags": tags,
            "keywords": tags,
            "source": source_type,
            "source_id": source_external_id or str(item.get("id") or "") or None,
            "source_url": source_url,
            "field_confidence": conf,
        }
        if salary_min is not None:
            conf["salary_min"] = 0.55
        if salary_max is not None:
            conf["salary_max"] = 0.55
        draft["field_confidence"] = conf
        return draft

    elif fmt == "imap":
        title = str(raw_data.get("subject") or "").strip()
        company = str(raw_data.get("from") or "Unknown").strip()
        description = _strip_html(str(raw_data.get("body_preview") or ""))
        urls = raw_data.get("urls") or []
        if isinstance(urls, list) and urls:
            application_url = str(urls[0])
        conf["title"] = 0.8 if title else 0.2
        conf["company"] = 0.5
        conf["description"] = 0.7 if description else 0.2

    else:
        # Generic fallback
        title = str(raw_data.get("title") or raw_data.get("subject") or "Untitled role").strip()
        company = str(raw_data.get("company") or raw_data.get("from") or "Unknown").strip()
        description = _strip_html(str(raw_data.get("description") or raw_data.get("body") or ""))
        conf["title"] = 0.5
        conf["company"] = 0.4
        conf["description"] = 0.4 if description else 0.1

    blob = f"{title} {description}"
    is_remote, remote_type = _remote_flags(blob)
    salary_min, salary_max = _parse_salary_cents(blob)
    tags = _tags_from_text(blob)
    emails = _EMAIL_RE.findall(description)

    if salary_min is not None:
        conf["salary_min"] = 0.5
    if salary_max is not None:
        conf["salary_max"] = 0.5
    conf["is_remote"] = 0.7 if is_remote else 0.4

    return {
        "title": title or "Untitled role",
        "company": company or "Unknown",
        "location": None,
        "is_remote": is_remote,
        "remote_type": remote_type,
        "description": description or None,
        "application_url": application_url,
        "application_email": emails[0] if emails else None,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "salary_currency": "USD",
        "tags": tags,
        "keywords": tags,
        "source": source_type,
        "source_id": source_external_id,
        "source_url": source_url,
        "field_confidence": conf,
    }

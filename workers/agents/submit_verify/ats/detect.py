"""Detect ATS vendor from job application URL."""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

AtsVendor = Literal["greenhouse", "lever", "unknown"]


_GREENHOUSE_HOST = re.compile(
    r"(boards\.greenhouse\.io|boards-api\.greenhouse\.io|job-boards\.greenhouse\.io)",
    re.I,
)
_LEVER_HOST = re.compile(r"(jobs\.lever\.co|api\.lever\.co)", re.I)


def detect_ats(url: str | None) -> AtsVendor:
    if not url:
        return "unknown"
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path
    if _GREENHOUSE_HOST.search(host) or "greenhouse.io" in host:
        return "greenhouse"
    if _LEVER_HOST.search(host) or host.endswith("lever.co"):
        return "lever"
    # Some embeds put vendor in path
    if "greenhouse" in path.lower():
        return "greenhouse"
    if "/lever/" in path.lower():
        return "lever"
    return "unknown"


def parse_greenhouse_board_and_job(url: str) -> tuple[str, str] | None:
    """
    Parse https://boards.greenhouse.io/{board}/jobs/{id}
    or .../embed/job_app?for=board&token=id
    """
    parsed = urlparse(url)
    m = re.search(r"/([^/]+)/jobs/(\d+)", parsed.path)
    if m:
        return m.group(1), m.group(2)
    q = parsed.query
    board = re.search(r"(?:^|&)for=([^&]+)", q)
    token = re.search(r"(?:^|&)token=([^&]+)", q)
    if board and token:
        return board.group(1), token.group(1)
    return None


def parse_lever_site_and_posting(url: str) -> tuple[str, str] | None:
    """Parse https://jobs.lever.co/{site}/{posting_id}."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None

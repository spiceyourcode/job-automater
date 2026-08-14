"""Detect ATS vendor from job application URL."""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

AtsVendor = Literal["greenhouse", "lever", "workday", "ashby", "unknown"]


_GREENHOUSE_HOST = re.compile(
    r"(boards\.greenhouse\.io|boards-api\.greenhouse\.io|job-boards\.greenhouse\.io)",
    re.I,
)
_LEVER_HOST = re.compile(r"(jobs\.lever\.co|api\.lever\.co)", re.I)
_WORKDAY_HOST = re.compile(r"myworkdayjobs\.com$", re.I)
_ASHBY_HOST = re.compile(r"(jobs\.ashbyhq\.com|api\.ashbyhq\.com)", re.I)


def detect_ats(url: str | None) -> AtsVendor:
    if not url:
        return "unknown"
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path
    if _GREENHOUSE_HOST.search(host) or "greenhouse.io" in host:
        return "greenhouse"
    if _LEVER_HOST.search(host) or host.endswith("lever.co"):
        return "lever"
    if _WORKDAY_HOST.search(host) or host.endswith("myworkdayjobs.com"):
        return "workday"
    if _ASHBY_HOST.search(host) or "ashbyhq.com" in host:
        return "ashby"
    # Some embeds put vendor in path
    if "greenhouse" in path.lower():
        return "greenhouse"
    if "/lever/" in path.lower():
        return "lever"
    if "workday" in path.lower() or "myworkday" in path.lower():
        return "workday"
    if "ashby" in path.lower():
        return "ashby"
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


def parse_ashby_org_and_posting(url: str) -> tuple[str, str] | None:
    """
    Parse https://jobs.ashbyhq.com/{org}/{postingId}
    or https://jobs.ashbyhq.com/{org}/job/{postingId}
    """
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 3 and parts[1].lower() == "job":
        return parts[0], parts[2]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None


def parse_workday_tenant_site_job(url: str) -> tuple[str, str, str] | None:
    """
    Parse https://{tenant}.wdN.myworkdayjobs.com/{site}/job/{Job-Title_ReqId}
    or with locale: .../en-US/{site}/job/{slug}
    Returns (tenant, site, job_path_id).
    """
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    m = re.match(r"^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$", host)
    if not m:
        # Some hosts are tenant.myworkdayjobs.com without wdN
        m2 = re.match(r"^([a-z0-9-]+)\.myworkdayjobs\.com$", host)
        if not m2:
            return None
        tenant = m2.group(1)
    else:
        tenant = m.group(1)

    parts = [p for p in parsed.path.split("/") if p]
    # Drop leading locale like en-US
    if parts and re.match(r"^[a-z]{2}(-[A-Z]{2})?$", parts[0]):
        parts = parts[1:]
    if len(parts) < 3 or parts[1].lower() != "job":
        return None
    site = parts[0]
    job_id = parts[2]
    return tenant, site, job_id

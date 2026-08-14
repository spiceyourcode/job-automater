"""Detect which portal applier to use from application URL."""

from __future__ import annotations

from typing import Literal
from urllib.parse import urlparse

PortalKind = Literal["linkedin", "indeed", "generic"]


def detect_portal(url: str | None) -> PortalKind:
    if not url:
        return "generic"
    host = urlparse(url).netloc.lower()
    if "linkedin.com" in host:
        return "linkedin"
    if "indeed." in host or host.endswith("indeed.com"):
        return "indeed"
    return "generic"

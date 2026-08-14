"""LinkedIn Easy Apply portal applier (P10.2)."""

from __future__ import annotations

from typing import Any

from agents.submit_verify.portals.common import run_playwright_flow
from agents.submit_verify.schema import SubmitResult

_OPEN = (
    'button:has-text("Easy Apply")',
    'button[aria-label*="Easy Apply" i]',
    'button:has-text("Apply")',
)
_SUBMIT = (
    'button:has-text("Submit application")',
    'button:has-text("Submit")',
    'button[aria-label*="Submit" i]',
    'button[type="submit"]',
)


def linkedin_easy_apply(
    application: dict[str, Any],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> SubmitResult:
    url = job.get("application_url") or job.get("source_url")
    if not url:
        return SubmitResult(status="error", error="missing_application_url")
    _ = application
    return run_playwright_flow(
        url=str(url),
        profile=profile,
        open_selectors=_OPEN,
        submit_selectors=_SUBMIT,
        via_label="li",
    )

"""Generic career-page portal applier (P10.2)."""

from __future__ import annotations

from typing import Any

from agents.submit_verify.portals.common import run_playwright_flow
from agents.submit_verify.schema import SubmitResult

_OPEN = (
    'button:has-text("Apply")',
    'a:has-text("Apply")',
    'button:has-text("Apply now")',
)
_SUBMIT = (
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
)


def generic_career_apply(
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
        via_label="generic",
    )

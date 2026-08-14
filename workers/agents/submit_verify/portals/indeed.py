"""Indeed Apply portal applier (P10.2)."""

from __future__ import annotations

from typing import Any

from agents.submit_verify.portals.common import run_playwright_flow
from agents.submit_verify.schema import SubmitResult

_OPEN = (
    'button:has-text("Apply now")',
    'button:has-text("Indeed Apply")',
    'button:has-text("Apply")',
    'a:has-text("Apply now")',
)
_SUBMIT = (
    'button:has-text("Continue")',
    'button:has-text("Submit")',
    'button[type="submit"]',
    'button:has-text("Apply")',
)


def indeed_apply(
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
        via_label="indeed",
    )

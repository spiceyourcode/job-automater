"""Portal appliers router — LinkedIn / Indeed / generic (P10.2)."""

from __future__ import annotations

from typing import Any

from agents.submit_verify.portals.detect import detect_portal
from agents.submit_verify.portals.generic import generic_career_apply
from agents.submit_verify.portals.indeed import indeed_apply
from agents.submit_verify.portals.linkedin import linkedin_easy_apply
from agents.submit_verify.schema import SubmitResult


def apply_via_portal(
    application: dict[str, Any],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> SubmitResult:
    url = job.get("application_url") or job.get("source_url")
    kind = detect_portal(str(url) if url else None)
    if kind == "linkedin":
        return linkedin_easy_apply(application, job, profile)
    if kind == "indeed":
        return indeed_apply(application, job, profile)
    return generic_career_apply(application, job, profile)

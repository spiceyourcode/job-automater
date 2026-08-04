"""SubmitVerify schemas — confirmation without logging PII (HG-8)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SubmitResult(BaseModel):
    status: Literal["submitted", "captcha", "error"]
    submitted_via: str = "auto_portal"
    external_application_id: str | None = None
    screenshot_bytes: bytes | None = Field(default=None, repr=False)
    error: str | None = None

    model_config = {"extra": "forbid"}

"""Normalized job schema — unvalidated LLM output must never reach the DB (HG-9)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class RemoteType(str, Enum):
    FULLY_REMOTE = "fully_remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    REMOTE_OK = "remote_ok"


class EmploymentType(str, Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    FREELANCE = "freelance"


class ExperienceLevel(str, Enum):
    ENTRY = "entry"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    EXECUTIVE = "executive"


class SalaryPeriod(str, Enum):
    YEARLY = "yearly"
    MONTHLY = "monthly"
    HOURLY = "hourly"


class FieldConfidence(BaseModel):
    """Confidence 0–1 for a single extracted field."""

    model_config = {"extra": "forbid"}

    value: Any
    confidence: float = Field(ge=0.0, le=1.0)


class NormalizedJob(BaseModel):
    """
    Structured job after extract/normalize.
    salary_min / salary_max are integer **cents** (HG-3).
    """

    model_config = {"extra": "forbid"}

    title: str = Field(min_length=1, max_length=500)
    company: str = Field(min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    is_remote: bool = False
    remote_type: RemoteType | None = None
    employment_type: EmploymentType | None = None
    experience_level: ExperienceLevel | None = None
    salary_min: int | None = None  # cents
    salary_max: int | None = None  # cents
    salary_currency: str = Field(default="USD", min_length=3, max_length=3)
    salary_period: SalaryPeriod = SalaryPeriod.YEARLY
    description: str | None = None
    requirements: str | None = None
    responsibilities: str | None = None
    benefits: str | None = None
    nice_to_have: str | None = None
    posted_at: datetime | None = None
    application_url: str | None = None
    application_email: str | None = None
    application_method: str | None = None
    tags: list[str] = Field(default_factory=list)
    tech_stack: list[dict[str, Any]] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    source: str = Field(min_length=1, max_length=50)
    source_id: str | None = None
    source_url: str | None = None
    field_confidence: dict[str, float] = Field(default_factory=dict)

    @field_validator("salary_min", "salary_max")
    @classmethod
    def salary_non_negative_cents(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("salary must be non-negative integer cents")
        return v

    @field_validator("salary_currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def require_core_confidence(self) -> NormalizedJob:
        for key in ("title", "company"):
            conf = self.field_confidence.get(key)
            if conf is None:
                raise ValueError(f"field_confidence.{key} is required")
            if not 0.0 <= conf <= 1.0:
                raise ValueError(f"field_confidence.{key} out of range")
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min cannot exceed salary_max")
        return self


def validate_normalized(data: dict[str, Any]) -> NormalizedJob:
    """Gate: only schema-valid jobs may be persisted."""
    return NormalizedJob.model_validate(data)

"""MatchScore schema — overall + breakdown + required reasoning."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

# TRD FR-JM-01
DEFAULT_WEIGHTS: dict[str, float] = {
    "skills": 0.40,
    "experience": 0.25,
    "location": 0.15,
    "salary": 0.10,
    "culture": 0.10,
}


class MatchScoreResult(BaseModel):
    model_config = {"extra": "forbid"}

    overall_score: float = Field(ge=0, le=100)
    skill_match: float = Field(ge=0, le=100)
    experience_match: float = Field(ge=0, le=100)
    location_match: float = Field(ge=0, le=100)
    salary_match: float = Field(ge=0, le=100)
    culture_match: float = Field(ge=0, le=100)
    weights: dict[str, float]
    matched_skills: list[dict[str, Any]] = Field(default_factory=list)
    missing_skills: list[dict[str, Any]] = Field(default_factory=list)
    nice_to_have_skills: list[dict[str, Any]] = Field(default_factory=list)
    reasoning: str = Field(min_length=20)
    confidence: float = Field(ge=0, le=1, default=0.7)
    model_used: str = "heuristic-v1"

    @field_validator("reasoning")
    @classmethod
    def reasoning_not_blank(cls, v: str) -> str:
        text = v.strip()
        if len(text) < 20:
            raise ValueError("reasoning required (min 20 chars)")
        return text

    @model_validator(mode="after")
    def weights_sum_near_one(self) -> MatchScoreResult:
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.02:
            raise ValueError(f"weights must sum to ~1.0, got {total}")
        return self


def validate_match_score(data: dict[str, Any]) -> MatchScoreResult:
    return MatchScoreResult.model_validate(data)

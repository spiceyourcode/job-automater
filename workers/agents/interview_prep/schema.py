"""Pydantic schemas for interview prep — STAR must cite cv_chunks (HG-9)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class InterviewQuestion(BaseModel):
    model_config = {"extra": "forbid"}

    question: str = Field(min_length=8, max_length=500)
    suggested_answer: str = Field(min_length=8, max_length=4000)
    category: Literal["behavioral", "technical", "company", "negotiation"]
    chunk_ids: list[str] = Field(default_factory=list, max_length=20)


class StarStory(BaseModel):
    model_config = {"extra": "forbid"}

    title: str = Field(min_length=3, max_length=200)
    situation: str = Field(min_length=8, max_length=2000)
    task: str = Field(min_length=8, max_length=2000)
    action: str = Field(min_length=8, max_length=2000)
    result: str = Field(min_length=8, max_length=2000)
    chunk_ids: list[str] = Field(min_length=1, max_length=10)


class NegotiationScript(BaseModel):
    model_config = {"extra": "forbid"}

    currency: str = Field(min_length=3, max_length=3)
    range_min_cents: int | None = None
    range_max_cents: int | None = None
    target_cents: int | None = None
    walkaway_cents: int | None = None
    talking_points: list[str] = Field(default_factory=list, max_length=12)
    chunk_ids: list[str] = Field(default_factory=list, max_length=20)

    @field_validator(
        "range_min_cents",
        "range_max_cents",
        "target_cents",
        "walkaway_cents",
    )
    @classmethod
    def integer_cents(cls, v: int | None) -> int | None:
        if v is None:
            return None
        if not isinstance(v, int) or isinstance(v, bool) or v < 0:
            raise ValueError("salary must be non-negative integer cents")
        return v


class InterviewPrepPack(BaseModel):
    model_config = {"extra": "forbid"}

    questions: list[InterviewQuestion] = Field(min_length=1, max_length=20)
    star_stories: list[StarStory] = Field(min_length=1, max_length=10)
    negotiation: NegotiationScript
    model_used: str = "heuristic-prep-v1"

    @model_validator(mode="after")
    def stories_have_chunks(self) -> InterviewPrepPack:
        for s in self.star_stories:
            if not s.chunk_ids:
                raise ValueError("star story missing chunk_ids")
        return self


def validate_prep(data: dict[str, Any]) -> InterviewPrepPack:
    return InterviewPrepPack.model_validate(data)


def assert_star_grounded(
    pack: InterviewPrepPack,
    chunks: list[dict[str, Any]],
) -> None:
    """HG-9: STAR fields must overlap their cited chunk content."""
    by_id = {str(c["id"]): str(c.get("content") or "") for c in chunks}
    for story in pack.star_stories:
        blob = " ".join(by_id.get(cid, "") for cid in story.chunk_ids).lower()
        if not blob.strip():
            raise ValueError("star story cites unknown chunks")
        text = f"{story.situation} {story.task} {story.action} {story.result}"
        tokens = [w for w in text.lower().split() if len(w) > 3]
        if not tokens:
            raise ValueError("star story has no substantive tokens")
        hits = sum(1 for w in tokens if w in blob)
        if hits / len(tokens) < 0.35:
            raise ValueError("star story not grounded in cited chunks")

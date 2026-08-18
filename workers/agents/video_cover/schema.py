"""Pydantic schemas for video cover-letter scripts — must cite cv_chunks (HG-9)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class VideoCoverPack(BaseModel):
    model_config = {"extra": "forbid"}

    script: str = Field(min_length=40, max_length=4000)
    hook: str = Field(min_length=8, max_length=800)
    close: str = Field(min_length=8, max_length=500)
    chunk_ids: list[str] = Field(min_length=1, max_length=20)
    estimated_seconds: int = Field(ge=15, le=180)
    model_used: str = "heuristic-video-cl-v1"

    @field_validator("estimated_seconds")
    @classmethod
    def integer_seconds(cls, v: int) -> int:
        if not isinstance(v, int) or isinstance(v, bool):
            raise ValueError("estimated_seconds must be int")
        return v

    @model_validator(mode="after")
    def hook_in_script(self) -> VideoCoverPack:
        if self.hook.strip() not in self.script:
            raise ValueError("hook must appear in script")
        if self.close.strip() not in self.script:
            raise ValueError("close must appear in script")
        return self


def validate_video_cover(data: dict[str, Any]) -> VideoCoverPack:
    return VideoCoverPack.model_validate(data)


def assert_script_grounded(
    pack: VideoCoverPack,
    chunks: list[dict[str, Any]],
) -> None:
    """HG-9: hook must overlap cited chunk content; no invented work history."""
    by_id = {str(c["id"]): str(c.get("content") or "") for c in chunks}
    blob = " ".join(by_id.get(cid, "") for cid in pack.chunk_ids).lower()
    if not blob.strip():
        raise ValueError("script cites unknown chunks")
    tokens = [w for w in pack.hook.lower().split() if len(w) > 3]
    if not tokens:
        raise ValueError("hook has no substantive tokens")
    hits = sum(1 for w in tokens if w in blob)
    if hits / len(tokens) < 0.35:
        raise ValueError("hook not grounded in cited chunks")

"""Pydantic schemas for GenerateDocs — HG-9 grounding required."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class BulletTrace(BaseModel):
    model_config = {"extra": "forbid"}

    text: str = Field(min_length=8, max_length=2000)
    chunk_id: str = Field(min_length=1)
    section: str = Field(min_length=1, max_length=50)
    status: str | None = Field(default=None, max_length=20)


class GeneratedDocuments(BaseModel):
    model_config = {"extra": "forbid"}

    tailored_cv: str = Field(min_length=40)
    cover_letter: str = Field(min_length=40)
    bullet_traces: list[BulletTrace] = Field(min_length=1)
    model_used: str = "heuristic-docs-v1"

    @field_validator("tailored_cv", "cover_letter")
    @classmethod
    def strip_content(cls, v: str) -> str:
        return v.strip()

    @model_validator(mode="after")
    def every_bullet_in_docs(self) -> GeneratedDocuments:
        blob = f"{self.tailored_cv}\n{self.cover_letter}".lower()
        for t in self.bullet_traces:
            # Allow whitespace-normalized containment
            needle = " ".join(t.text.lower().split())
            hay = " ".join(blob.split())
            if needle not in hay and t.text.lower() not in self.tailored_cv.lower():
                # Cover letter bullets may only appear in CL
                if t.text.lower() not in self.cover_letter.lower():
                    raise ValueError(
                        f"bullet text not found in generated docs (chunk={t.chunk_id})"
                    )
        return self


def validate_generated(data: dict[str, Any]) -> GeneratedDocuments:
    return GeneratedDocuments.model_validate(data)


def assert_grounded_in_chunks(
    docs: GeneratedDocuments,
    chunks: list[dict[str, Any]],
) -> None:
    """
    HG-9: every traced bullet must be supported by its chunk content
    (substring / token overlap) — no fabricated employers/skills.
    """
    by_id = {str(c["id"]): str(c.get("content") or "") for c in chunks}
    for t in docs.bullet_traces:
        source = by_id.get(t.chunk_id)
        if source is None:
            raise ValueError(f"unknown chunk_id={t.chunk_id}")
        src_l = source.lower()
        # Require substantial token overlap with the source chunk
        tokens = [w for w in t.text.lower().split() if len(w) > 3]
        if not tokens:
            raise ValueError("bullet has no substantive tokens")
        hits = sum(1 for w in tokens if w in src_l)
        if hits / len(tokens) < 0.5:
            raise ValueError(
                f"bullet not grounded in chunk {t.chunk_id} (overlap={hits}/{len(tokens)})"
            )

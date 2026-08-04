"""Base collector ABC — every source type implements collect()."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class RawJob:
    """One collected listing before normalize (P2.3)."""

    source_external_id: str
    source_url: str | None
    raw_data: dict[str, Any]
    title: str | None = None
    company: str | None = None
    dedup_parts: list[str] = field(default_factory=list)


class BaseCollector(ABC):
    """Async collector interface. Config is the source_configs.config JSONB."""

    source_type: str

    @abstractmethod
    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        """Fetch jobs for this source. Must not log secrets (HG-8)."""
        ...

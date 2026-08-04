"""Collector registry — map source_type → BaseCollector instance."""

from __future__ import annotations

from collectors.api import ApiCollector
from collectors.base import BaseCollector
from collectors.imap import ImapCollector
from collectors.rss import RssCollector

_REGISTRY: dict[str, BaseCollector] = {
    RssCollector.source_type: RssCollector(),
    ApiCollector.source_type: ApiCollector(),
    ImapCollector.source_type: ImapCollector(),
}


def get_collector(source_type: str) -> BaseCollector:
    collector = _REGISTRY.get(source_type)
    if collector is None:
        raise KeyError(f"No collector registered for source_type={source_type!r}")
    return collector


def list_collectors() -> list[str]:
    return sorted(_REGISTRY.keys())

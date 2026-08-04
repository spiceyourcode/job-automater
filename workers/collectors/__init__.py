"""Source collector plugins — register via registry.get_collector(source_type)."""

from collectors.base import BaseCollector, RawJob
from collectors.registry import get_collector, list_collectors

__all__ = ["BaseCollector", "RawJob", "get_collector", "list_collectors"]

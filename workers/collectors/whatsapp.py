"""WhatsApp job source — exported chat parse; optional saved Playwright session.

Never waits on a QR prompt in collect() (CI-safe). Chat bodies are not logged (HG-8).
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any

from collectors.base import BaseCollector, RawJob

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
_LINE_RE = re.compile(
    r"^(?:\u200e)?(?:\[)?\d{1,2}[/-]\d{1,2}[/-]\d{2,4}.+?\]?\s+"
    r"(?:-\s+)?(?:[^:]{1,80}:\s+)?(?P<body>.+)$"
)


def export_lines_to_raw_jobs(
    text: str,
    *,
    message_filter: str | None = None,
) -> list[RawJob]:
    """Parse a WhatsApp exported .txt into RawJobs (pure — unit tested)."""
    pattern: re.Pattern[str] | None = None
    if message_filter and message_filter.strip():
        pattern = re.compile(message_filter, re.I)

    jobs: list[RawJob] = []
    for idx, raw_line in enumerate(text.splitlines()):
        line = raw_line.strip()
        if not line:
            continue
        match = _LINE_RE.match(line)
        body = match.group("body").strip() if match else line
        if pattern and not pattern.search(body):
            continue
        urls = _URL_RE.findall(body)
        if not urls and "hiring" not in body.lower() and "job" not in body.lower():
            continue
        external = f"wa:{idx}:{body[:80]}"
        source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]
        title = body.split("\n", 1)[0][:200]
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=urls[0] if urls else None,
                title=title,
                company=None,
                raw_data={"line_index": idx, "preview_len": len(body)},
                dedup_parts=[source_id],
            )
        )
    return jobs


class WhatsappCollector(BaseCollector):
    source_type = "whatsapp"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        export_path = str(config.get("exportPath") or config.get("export_path") or "")
        message_filter = config.get("messageFilter") or config.get("message_filter")
        if not export_path:
            logger.info("whatsapp_collect_skip reason=no_export_path")
            return []
        path = Path(export_path)
        if not path.is_file():
            logger.warning("whatsapp_export_missing")
            return []
        text = path.read_text(encoding="utf-8", errors="replace")
        jobs = export_lines_to_raw_jobs(
            text,
            message_filter=str(message_filter) if message_filter else None,
        )
        logger.info("whatsapp_collect_ok count=%s", len(jobs))
        return jobs

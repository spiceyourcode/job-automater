"""RSS/Atom collector — parse feed entries into RawJob list."""

from __future__ import annotations

import hashlib
import logging
from typing import Any
from xml.etree import ElementTree as ET

import httpx

from collectors.base import BaseCollector, RawJob

logger = logging.getLogger(__name__)

_ATOM = "{http://www.w3.org/2005/Atom}"
_USER_AGENT = "JobAutomater/1.0 collector-rss"


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def parse_feed_xml(xml_text: str, feed_url: str) -> list[RawJob]:
    """Parse RSS 2.0 or Atom XML into RawJobs (pure — used by golden tests)."""
    root = ET.fromstring(xml_text)
    jobs: list[RawJob] = []

    # RSS 2.0: channel/item
    for item in root.iter():
        if _local(item.tag) != "item":
            continue
        title = ""
        link = ""
        guid = ""
        description = ""
        pub_date = ""
        for child in list(item):
            name = _local(child.tag)
            if name == "title":
                title = _text(child)
            elif name == "link":
                link = _text(child)
            elif name == "guid":
                guid = _text(child)
            elif name == "description":
                description = _text(child) or description
            elif name in ("encoded", "content"):
                # content:encoded / media body often holds the full JD
                richer = "".join(child.itertext()).strip() or _text(child)
                if len(richer) > len(description):
                    description = richer
            elif name == "pubDate":
                pub_date = _text(child)
        external = guid or link or title
        if not external:
            continue
        source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=link or feed_url,
                title=title or None,
                company=None,
                dedup_parts=[title.lower(), link],
                raw_data={
                    "title": title,
                    "link": link,
                    "guid": guid,
                    "description": description,
                    "pubDate": pub_date,
                    "format": "rss",
                },
            )
        )

    if jobs:
        return jobs

    # Atom: entry
    for entry in root.iter():
        if _local(entry.tag) != "entry":
            continue
        title = ""
        link = ""
        entry_id = ""
        summary = ""
        updated = ""
        for child in list(entry):
            name = _local(child.tag)
            if name == "title":
                title = _text(child)
            elif name == "id":
                entry_id = _text(child)
            elif name == "summary" or name == "content":
                richer = "".join(child.itertext()).strip() or _text(child)
                if len(richer) > len(summary):
                    summary = richer
            elif name == "updated" or name == "published":
                updated = _text(child) or updated
            elif name == "link":
                href = child.attrib.get("href", "")
                rel = child.attrib.get("rel", "alternate")
                if href and (rel == "alternate" or not link):
                    link = href
        external = entry_id or link or title
        if not external:
            continue
        source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=link or feed_url,
                title=title or None,
                company=None,
                dedup_parts=[title.lower(), link],
                raw_data={
                    "title": title,
                    "link": link,
                    "id": entry_id,
                    "summary": summary,
                    "description": summary,
                    "updated": updated,
                    "format": "atom",
                },
            )
        )

    return jobs


class RssCollector(BaseCollector):
    source_type = "rss"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        feed_url = str(config.get("feedUrl") or config.get("feed_url") or "")
        if not feed_url:
            raise ValueError("RSS config missing feedUrl")

        keywords = config.get("keywords") or []
        if not isinstance(keywords, list):
            keywords = []

        async with httpx.AsyncClient(
            timeout=30.0,
            headers={"user-agent": _USER_AGENT},
            follow_redirects=True,
        ) as client:
            response = await client.get(feed_url)
            response.raise_for_status()
            xml_text = response.text

        jobs = parse_feed_xml(xml_text, feed_url)

        if keywords:
            lowered = [str(k).lower() for k in keywords]
            filtered: list[RawJob] = []
            for job in jobs:
                blob = " ".join(
                    [
                        job.title or "",
                        str(job.raw_data.get("description") or ""),
                        str(job.raw_data.get("summary") or ""),
                    ]
                ).lower()
                if any(k in blob for k in lowered):
                    filtered.append(job)
            jobs = filtered

        logger.info(
            "rss_collect_ok entries=%s feed_host=%s",
            len(jobs),
            httpx.URL(feed_url).host,
        )
        return jobs

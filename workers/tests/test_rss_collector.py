"""Golden-set tests for RSS parse output."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from collectors.rss import parse_feed_xml

FIXTURES = Path(__file__).parent / "fixtures"


def test_parse_feed_matches_golden_set():
    xml_text = (FIXTURES / "sample_rss.xml").read_text(encoding="utf-8")
    golden = json.loads((FIXTURES / "golden_rss_parse.json").read_text(encoding="utf-8"))

    jobs = parse_feed_xml(xml_text, golden["feed_url"])

    assert len(jobs) == golden["expected_count"]
    for actual, expected in zip(jobs, golden["jobs"], strict=True):
        assert actual.title == expected["title"]
        assert actual.source_url == expected["source_url"]
        assert actual.raw_data == expected["raw_data"]
        assert actual.source_external_id  # stable hash present


@pytest.mark.asyncio
async def test_rss_collector_filters_keywords():
    import respx
    from httpx import Response

    from collectors.rss import RssCollector

    xml_text = (FIXTURES / "sample_rss.xml").read_text(encoding="utf-8")
    feed_url = "https://jobs.example.com/feed.xml"

    with respx.mock:
        respx.get(feed_url).mock(return_value=Response(200, text=xml_text))
        collector = RssCollector()
        jobs = await collector.collect(
            {"feedUrl": feed_url, "keywords": ["python", "fastapi"]}
        )

    assert len(jobs) == 1
    assert jobs[0].title == "Senior Python Engineer"

"""Playwright / career_page collector unit tests (no live browser)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from collectors.career_page import CareerPageCollector, build_career_start_url
from collectors.playwright import PlaywrightCollector
from collectors.playwright_scrape import cards_to_raw_jobs, extract_cards_with_playwright
from collectors.registry import get_collector, list_collectors


def test_registry_includes_playwright_and_career_page():
    types = list_collectors()
    assert "playwright" in types
    assert "career_page" in types
    assert get_collector("playwright").source_type == "playwright"
    assert get_collector("career_page").source_type == "career_page"


def test_build_career_start_url():
    assert (
        build_career_start_url("https://acme.com", "/careers")
        == "https://acme.com/careers"
    )
    assert (
        build_career_start_url("https://acme.com/", "jobs")
        == "https://acme.com/jobs"
    )


def test_cards_to_raw_jobs_maps_fields():
    cards = [
        {
            "title": "Senior Engineer",
            "url": "/jobs/1",
            "location": "Remote",
            "department": "Eng",
        },
        {"title": "", "url": "", "location": None, "department": None},
    ]
    jobs = cards_to_raw_jobs(cards, base_url="https://acme.com/careers")
    assert len(jobs) == 1
    assert jobs[0].title == "Senior Engineer"
    assert jobs[0].source_url == "https://acme.com/jobs/1"
    assert jobs[0].raw_data["location"] == "Remote"
    assert jobs[0].source_external_id


@pytest.mark.asyncio
async def test_extract_cards_with_mocked_page():
    page = MagicMock()
    cards_loc = MagicMock()
    page.locator.return_value = cards_loc
    cards_loc.count = AsyncMock(return_value=1)

    card = MagicMock()
    cards_loc.nth.return_value = card

    title_el = MagicMock()
    title_el.count = AsyncMock(return_value=1)
    title_el.inner_text = AsyncMock(return_value="  Backend  ")
    title_el.get_attribute = AsyncMock(return_value="/j/9")

    def card_locator(sel: str):
        loc = MagicMock()
        loc.first = title_el if "title" in sel else MagicMock()
        if "title" not in sel:
            loc.first.count = AsyncMock(return_value=0)
        return loc

    card.locator.side_effect = card_locator

    cards = await extract_cards_with_playwright(
        page,
        job_card_selector=".job-card",
        title_selector=".job-title a",
    )
    assert len(cards) == 1
    assert cards[0]["title"] == "Backend"
    assert cards[0]["url"] == "/j/9"


@pytest.mark.asyncio
async def test_playwright_collector_requires_selectors():
    collector = PlaywrightCollector()
    with pytest.raises(ValueError, match="startUrl"):
        await collector.collect({})


@pytest.mark.asyncio
async def test_career_page_collector_requires_base():
    collector = CareerPageCollector()
    with pytest.raises(ValueError, match="baseUrl"):
        await collector.collect(
            {"jobCardSelector": ".c", "titleSelector": ".t"}
        )

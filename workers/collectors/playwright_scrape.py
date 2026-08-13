"""Shared career-page / Playwright list scraping helpers (no secrets in logs)."""

from __future__ import annotations

import hashlib
import logging
from typing import Any
from urllib.parse import urljoin

from collectors.base import RawJob

logger = logging.getLogger(__name__)


def cards_to_raw_jobs(
    cards: list[dict[str, str | None]],
    *,
    base_url: str,
) -> list[RawJob]:
    """Map extracted card fields → RawJob. Pure — used by tests + collectors."""
    jobs: list[RawJob] = []
    for card in cards:
        title = (card.get("title") or "").strip() or None
        href = (card.get("url") or "").strip() or None
        location = (card.get("location") or "").strip() or None
        department = (card.get("department") or "").strip() or None
        if href:
            href = urljoin(base_url, href)
        external = href or title
        if not external:
            continue
        source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=href or base_url,
                title=title,
                company=None,
                dedup_parts=[(title or "").lower(), href or ""],
                raw_data={
                    "title": title,
                    "url": href,
                    "location": location,
                    "department": department,
                    "format": "playwright",
                },
            )
        )
    return jobs


async def extract_cards_with_playwright(
    page: Any,
    *,
    job_card_selector: str,
    title_selector: str,
    url_selector: str | None = None,
    location_selector: str | None = None,
    department_selector: str | None = None,
) -> list[dict[str, str | None]]:
    """
    Extract job cards from an already-navigated Playwright page.
    Never logs card text bodies (HG-8) — only counts.
    """
    cards_loc = page.locator(job_card_selector)
    count = await cards_loc.count()
    logger.info("playwright_cards_found count=%s", count)
    out: list[dict[str, str | None]] = []
    for i in range(count):
        card = cards_loc.nth(i)
        title = None
        url = None
        location = None
        department = None
        try:
            title_el = card.locator(title_selector).first
            if await title_el.count() > 0:
                title = (await title_el.inner_text()).strip()
                if url_selector is None:
                    # Prefer href on the title element itself
                    href = await title_el.get_attribute("href")
                    if href:
                        url = href
        except Exception:  # noqa: BLE001
            title = None
        if url_selector:
            try:
                url_el = card.locator(url_selector).first
                if await url_el.count() > 0:
                    href = await url_el.get_attribute("href")
                    url = href or (await url_el.inner_text()).strip()
            except Exception:  # noqa: BLE001
                pass
        if location_selector:
            try:
                loc_el = card.locator(location_selector).first
                if await loc_el.count() > 0:
                    location = (await loc_el.inner_text()).strip()
            except Exception:  # noqa: BLE001
                pass
        if department_selector:
            try:
                dept_el = card.locator(department_selector).first
                if await dept_el.count() > 0:
                    department = (await dept_el.inner_text()).strip()
            except Exception:  # noqa: BLE001
                pass
        if title or url:
            out.append(
                {
                    "title": title,
                    "url": url,
                    "location": location,
                    "department": department,
                }
            )
    return out


async def scrape_paginated_list(
    *,
    start_url: str,
    job_card_selector: str,
    title_selector: str,
    url_selector: str | None = None,
    location_selector: str | None = None,
    department_selector: str | None = None,
    wait_for_selector: str | None = None,
    pagination_next_selector: str | None = None,
    max_pages: int = 1,
    login: dict[str, str] | None = None,
    timeout_ms: int = 15000,
) -> list[RawJob]:
    """Launch Chromium, scrape list pages, return RawJobs. Credentials never logged."""
    try:
        from playwright.async_api import async_playwright
    except ImportError as exc:
        raise RuntimeError(
            "playwright package not installed — pip install '.[playwright]'"
        ) from exc

    max_pages = max(1, min(int(max_pages), 20))
    all_cards: list[dict[str, str | None]] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent="JobAutomater/1.0 collector-playwright",
            )
            page = await context.new_page()
            page.set_default_timeout(timeout_ms)

            if login:
                login_url = login.get("loginUrl") or start_url
                await page.goto(login_url, wait_until="domcontentloaded")
                user_sel = login.get("usernameSelector")
                pass_sel = login.get("passwordSelector")
                submit_sel = login.get("submitSelector")
                # Never log username/password values
                if user_sel and login.get("username"):
                    await page.fill(user_sel, login["username"])
                if pass_sel and login.get("password"):
                    await page.fill(pass_sel, login["password"])
                if submit_sel:
                    await page.click(submit_sel)
                    await page.wait_for_load_state("domcontentloaded")
                logger.info("playwright_login_done")

            await page.goto(start_url, wait_until="domcontentloaded")
            if wait_for_selector:
                await page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

            for page_idx in range(max_pages):
                cards = await extract_cards_with_playwright(
                    page,
                    job_card_selector=job_card_selector,
                    title_selector=title_selector,
                    url_selector=url_selector,
                    location_selector=location_selector,
                    department_selector=department_selector,
                )
                all_cards.extend(cards)
                logger.info(
                    "playwright_page_scraped page=%s cards=%s",
                    page_idx + 1,
                    len(cards),
                )
                if not pagination_next_selector or page_idx + 1 >= max_pages:
                    break
                next_btn = page.locator(pagination_next_selector).first
                if await next_btn.count() == 0:
                    break
                try:
                    await next_btn.click()
                    await page.wait_for_load_state("domcontentloaded")
                    if wait_for_selector:
                        await page.wait_for_selector(
                            wait_for_selector, timeout=timeout_ms
                        )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "playwright_pagination_stop reason=%s",
                        type(exc).__name__,
                    )
                    break
        finally:
            await browser.close()

    return cards_to_raw_jobs(all_cards, base_url=start_url)

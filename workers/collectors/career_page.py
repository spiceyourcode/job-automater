"""Career-page collector — company careers listing via Playwright."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urljoin

from collectors.base import BaseCollector, RawJob
from collectors.playwright_scrape import scrape_paginated_list

logger = logging.getLogger(__name__)


def build_career_start_url(base_url: str, job_list_path: str) -> str:
    """Join base + list path (pure — unit tested)."""
    base = base_url.rstrip("/") + "/"
    path = job_list_path.lstrip("/")
    return urljoin(base, path)


class CareerPageCollector(BaseCollector):
    source_type = "career_page"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        base_url = str(config.get("baseUrl") or "").strip()
        list_path = str(config.get("jobListPath") or "/").strip() or "/"
        job_card = str(config.get("jobCardSelector") or "").strip()
        title_sel = str(config.get("titleSelector") or "").strip()
        if not base_url or not job_card or not title_sel:
            raise ValueError(
                "career_page config requires baseUrl, jobCardSelector, titleSelector"
            )

        start_url = build_career_start_url(base_url, list_path)
        logger.info("career_page_collect_start")  # no URL with query secrets

        jobs = await scrape_paginated_list(
            start_url=start_url,
            job_card_selector=job_card,
            title_selector=title_sel,
            url_selector=(str(config["urlSelector"]) if config.get("urlSelector") else None),
            location_selector=(
                str(config["locationSelector"]) if config.get("locationSelector") else None
            ),
            department_selector=(
                str(config["departmentSelector"])
                if config.get("departmentSelector")
                else None
            ),
            wait_for_selector=(
                str(config["waitForSelector"])
                if config.get("waitForSelector")
                else job_card
            ),
            pagination_next_selector=(
                str(config["paginationNextSelector"])
                if config.get("paginationNextSelector")
                else None
            ),
            max_pages=int(config.get("maxPages") or 1),
            login=None,
            timeout_ms=int(config.get("timeoutMs") or 15000),
        )
        # Tag format for downstream normalize
        for job in jobs:
            job.raw_data["format"] = "career_page"
        logger.info("career_page_collect_done jobs=%s", len(jobs))
        return jobs

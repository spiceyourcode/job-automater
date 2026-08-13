"""Playwright list-page collector — CSS selectors from source config."""

from __future__ import annotations

import logging
from typing import Any

from collectors.base import BaseCollector, RawJob
from collectors.playwright_scrape import scrape_paginated_list

logger = logging.getLogger(__name__)


class PlaywrightCollector(BaseCollector):
    source_type = "playwright"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        start_url = str(config.get("startUrl") or "").strip()
        job_card = str(config.get("jobCardSelector") or "").strip()
        title_sel = str(config.get("titleSelector") or "").strip()
        if not start_url or not job_card or not title_sel:
            raise ValueError(
                "playwright config requires startUrl, jobCardSelector, titleSelector"
            )

        login_cfg = config.get("login")
        login: dict[str, str] | None = None
        if isinstance(login_cfg, dict) and login_cfg:
            # Copy only known keys — never pass through unexpected blobs to logs
            login = {
                k: str(login_cfg[k])
                for k in (
                    "loginUrl",
                    "usernameSelector",
                    "passwordSelector",
                    "submitSelector",
                    "username",
                    "password",
                )
                if login_cfg.get(k)
            }

        logger.info(
            "playwright_collect_start has_login=%s max_pages=%s",
            bool(login),
            config.get("maxPages", 1),
        )

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
                str(config["waitForSelector"]) if config.get("waitForSelector") else None
            ),
            pagination_next_selector=(
                str(config["paginationNextSelector"])
                if config.get("paginationNextSelector")
                else None
            ),
            max_pages=int(config.get("maxPages") or 1),
            login=login,
            timeout_ms=int(config.get("timeoutMs") or 15000),
        )
        logger.info("playwright_collect_done jobs=%s", len(jobs))
        return jobs

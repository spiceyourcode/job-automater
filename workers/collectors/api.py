"""Generic REST API collector with optional field mapping."""

from __future__ import annotations

import hashlib
import logging
from typing import Any

import httpx

from collectors.base import BaseCollector, RawJob

logger = logging.getLogger(__name__)
_USER_AGENT = "JobAutomater/1.0 collector-api"


def _dig(obj: Any, path: str) -> Any:
    """Resolve dotted path like 'data.jobs' or 'results.0.title'."""
    cur: Any = obj
    for part in path.split("."):
        if cur is None:
            return None
        if part.isdigit() and isinstance(cur, list):
            idx = int(part)
            cur = cur[idx] if 0 <= idx < len(cur) else None
        elif isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def _as_list(payload: Any, list_path: str | None) -> list[Any]:
    if list_path:
        found = _dig(payload, list_path)
        if isinstance(found, list):
            return found
        return []
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("jobs", "results", "items", "data"):
            if isinstance(payload.get(key), list):
                return payload[key]
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("jobs", "results", "items"):
                if isinstance(data.get(key), list):
                    return data[key]
    return []


def map_api_items(
    items: list[Any],
    field_mapping: dict[str, str] | None,
    base_url: str,
) -> list[RawJob]:
    """Map JSON items → RawJob (pure — unit-testable)."""
    mapping = field_mapping or {}
    title_key = mapping.get("title", "title")
    company_key = mapping.get("company", "company")
    url_key = mapping.get("url", "url")
    id_key = mapping.get("id", "id")

    jobs: list[RawJob] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = _dig(item, title_key) if "." in title_key else item.get(title_key)
        company = (
            _dig(item, company_key) if "." in company_key else item.get(company_key)
        )
        url = _dig(item, url_key) if "." in url_key else item.get(url_key)
        ext_id = _dig(item, id_key) if "." in id_key else item.get(id_key)
        title_s = str(title).strip() if title else ""
        url_s = str(url).strip() if url else ""
        ext = str(ext_id) if ext_id is not None else (url_s or title_s)
        if not ext:
            continue
        source_id = hashlib.sha256(ext.encode("utf-8")).hexdigest()[:64]
        jobs.append(
            RawJob(
                source_external_id=source_id,
                source_url=url_s or base_url,
                title=title_s or None,
                company=str(company).strip() if company else None,
                dedup_parts=[
                    title_s.lower(),
                    str(company or "").lower(),
                    url_s,
                ],
                raw_data={"item": item, "format": "api"},
            )
        )
    return jobs


class ApiCollector(BaseCollector):
    source_type = "api"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        base_url = str(config.get("baseUrl") or config.get("base_url") or "")
        if not base_url:
            raise ValueError("API config missing baseUrl")

        endpoints = config.get("endpoints") or [""]
        if not isinstance(endpoints, list) or len(endpoints) == 0:
            endpoints = [""]

        field_mapping = config.get("fieldMapping") or config.get("field_mapping")
        if field_mapping is not None and not isinstance(field_mapping, dict):
            field_mapping = None

        list_path = None
        if isinstance(field_mapping, dict) and "list" in field_mapping:
            list_path = str(field_mapping["list"])

        headers = {"user-agent": _USER_AGENT, "accept": "application/json"}
        auth = config.get("auth") or {}
        if isinstance(auth, dict):
            auth_type = auth.get("type", "none")
            creds = auth.get("credentials") or {}
            if not isinstance(creds, dict):
                creds = {}
            if auth_type == "bearer" and creds.get("token"):
                headers["authorization"] = f"Bearer {creds['token']}"
            elif auth_type == "api_key":
                header_name = creds.get("header", "X-API-Key")
                if creds.get("key"):
                    headers[str(header_name)] = str(creds["key"])
            elif auth_type == "basic" and creds.get("username"):
                # httpx handles basic via auth= tuple
                pass

        basic: tuple[str, str] | None = None
        if isinstance(auth, dict) and auth.get("type") == "basic":
            creds = auth.get("credentials") or {}
            if isinstance(creds, dict) and creds.get("username"):
                basic = (str(creds["username"]), str(creds.get("password", "")))

        all_jobs: list[RawJob] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            headers=headers,
            auth=basic,
            follow_redirects=True,
        ) as client:
            for endpoint in endpoints:
                path = str(endpoint or "").strip()
                url = base_url.rstrip("/") + ("/" + path.lstrip("/") if path else "")
                response = await client.get(url)
                response.raise_for_status()
                try:
                    payload = response.json()
                except ValueError as exc:
                    raise ValueError("API response is not JSON") from exc
                items = _as_list(payload, list_path)
                all_jobs.extend(map_api_items(items, field_mapping, base_url))

        # Never log auth headers or credentials
        logger.info(
            "api_collect_ok entries=%s host=%s",
            len(all_jobs),
            httpx.URL(base_url).host,
        )
        return all_jobs

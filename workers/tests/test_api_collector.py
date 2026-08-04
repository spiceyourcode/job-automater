"""API collector mapping tests."""

from __future__ import annotations

from collectors.api import map_api_items


def test_map_api_items_default_keys():
    items = [
        {
            "id": "42",
            "title": "Backend Engineer",
            "company": "Acme",
            "url": "https://example.com/j/42",
        }
    ]
    jobs = map_api_items(items, None, "https://example.com")
    assert len(jobs) == 1
    assert jobs[0].title == "Backend Engineer"
    assert jobs[0].company == "Acme"
    assert jobs[0].source_url == "https://example.com/j/42"
    assert jobs[0].source_external_id


def test_map_api_items_custom_mapping():
    items = [{"jobId": "9", "role": "SRE", "org": "Beta", "applyUrl": "https://b.test/9"}]
    mapping = {
        "id": "jobId",
        "title": "role",
        "company": "org",
        "url": "applyUrl",
    }
    jobs = map_api_items(items, mapping, "https://b.test")
    assert jobs[0].title == "SRE"
    assert jobs[0].company == "Beta"

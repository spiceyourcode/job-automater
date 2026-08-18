"""WhatsApp export parser — no live QR / session."""

from collectors.registry import get_collector, list_collectors
from collectors.whatsapp import export_lines_to_raw_jobs


def test_registry_includes_whatsapp():
    assert "whatsapp" in list_collectors()
    assert get_collector("whatsapp").source_type == "whatsapp"


def test_export_parses_job_lines_only():
    text = """
[8/18/26, 10:00:00 AM] Alice: Hiring senior python https://example.com/j/1
[8/18/26, 10:01:00 AM] Bob: lunch tomorrow?
8/18/26, 10:02 - Carol: New job posting backend engineer
"""
    jobs = export_lines_to_raw_jobs(text, message_filter="hiring|job")
    assert len(jobs) >= 2
    assert jobs[0].source_url == "https://example.com/j/1"
    assert all(j.raw_data.get("preview_len") for j in jobs)

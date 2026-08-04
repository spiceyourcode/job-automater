"""IMAP email collector — search mailbox for job-related messages."""

from __future__ import annotations

import asyncio
import email
import hashlib
import imaplib
import logging
import re
from email.header import decode_header
from typing import Any

from collectors.base import BaseCollector, RawJob

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)


def _decode_mime_header(value: str | None) -> str:
    if not value:
        return ""
    parts: list[str] = []
    for chunk, charset in decode_header(value):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(chunk)
    return "".join(parts).strip()


def message_to_raw_job(msg: email.message.Message, uid: str) -> RawJob:
    """Convert an email.message.Message into a RawJob (pure)."""
    subject = _decode_mime_header(msg.get("Subject"))
    from_addr = _decode_mime_header(msg.get("From"))
    message_id = (msg.get("Message-ID") or uid).strip()
    date = msg.get("Date") or ""

    body_text = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain" and not part.get_filename():
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    body_text = payload.decode(charset, errors="replace")
                    break
    else:
        payload = msg.get_payload(decode=True)
        if isinstance(payload, bytes):
            charset = msg.get_content_charset() or "utf-8"
            body_text = payload.decode(charset, errors="replace")

    urls = _URL_RE.findall(body_text)[:5]
    source_url = urls[0] if urls else None
    external = message_id or f"{uid}:{subject}"
    source_id = hashlib.sha256(external.encode("utf-8")).hexdigest()[:64]

    return RawJob(
        source_external_id=source_id,
        source_url=source_url,
        title=subject or None,
        company=from_addr or None,
        dedup_parts=[subject.lower(), message_id],
        raw_data={
            "subject": subject,
            "from": from_addr,
            "message_id": message_id,
            "date": date,
            "body_preview": body_text[:2000],
            "urls": urls,
            "format": "imap",
        },
    )


def _fetch_sync(config: dict[str, Any]) -> list[RawJob]:
    server = str(config.get("imapServer") or config.get("imap_server") or "")
    port = int(config.get("port") or 993)
    username = str(config.get("username") or "")
    password = str(config.get("password") or "")
    folder = str(config.get("folder") or "INBOX")
    criteria = str(config.get("searchCriteria") or config.get("search_criteria") or "ALL")

    if not server or not username or not password:
        raise ValueError("IMAP config incomplete")

    client = imaplib.IMAP4_SSL(server, port)
    try:
        client.login(username, password)
        typ, _ = client.select(folder, readonly=True)
        if typ != "OK":
            raise ValueError(f"Cannot select folder {folder}")

        typ, data = client.search(None, criteria)
        if typ != "OK" or not data or not data[0]:
            return []

        uids = data[0].split()
        # Cap per run to avoid huge mailboxes
        uids = uids[-50:]
        jobs: list[RawJob] = []
        for uid in uids:
            typ, msg_data = client.fetch(uid, "(RFC822)")
            if typ != "OK" or not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            if not isinstance(raw, (bytes, bytearray)):
                continue
            msg = email.message_from_bytes(bytes(raw))
            jobs.append(message_to_raw_job(msg, uid.decode() if isinstance(uid, bytes) else str(uid)))
        return jobs
    finally:
        try:
            client.logout()
        except Exception:  # noqa: BLE001
            pass


class ImapCollector(BaseCollector):
    source_type = "imap"

    async def collect(self, config: dict[str, Any]) -> list[RawJob]:
        jobs = await asyncio.to_thread(_fetch_sync, config)
        # Never log username/password (HG-8)
        logger.info(
            "imap_collect_ok entries=%s server=%s",
            len(jobs),
            str(config.get("imapServer") or config.get("imap_server") or ""),
        )
        return jobs

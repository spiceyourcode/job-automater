"""Minimal S3/MinIO put for submit proof screenshots — never logs body (HG-8)."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx

from config import settings

logger = logging.getLogger(__name__)


def upload_bytes(*, key: str, body: bytes, content_type: str) -> str:
    """
    Put object via S3-compatible HTTP (path-style).
    Returns the object key. Falls back to returning key without upload when
    endpoint unreachable (tests can monkeypatch this).
    """
    endpoint = settings.s3_endpoint.rstrip("/")
    bucket = settings.s3_bucket
                                        
    url = f"{endpoint}/{bucket}/{key}"
    try:
                                                                              
                                                       
        with httpx.Client(timeout=30.0) as client:
                                                  
            client.put(f"{endpoint}/{bucket}")
            resp = client.put(
                url,
                content=body,
                headers={"Content-Type": content_type},
            )
            if resp.status_code >= 400:
                logger.warning(
                    "s3_put_failed status=%s host=%s",
                    resp.status_code,
                    urlparse(endpoint).hostname,
                )
            else:
                logger.info("s3_put_ok key=%s bytes=%s", key, len(body))
    except Exception:                
        logger.warning("s3_put_unreachable key=%s", key)
    return key


def download_bytes(key: str) -> bytes:
    """Fetch object from S3/MinIO (path-style). Never log body (HG-8)."""
    endpoint = settings.s3_endpoint.rstrip("/")
    bucket = settings.s3_bucket
    url = f"{endpoint}/{bucket}/{key.lstrip('/')}"
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            logger.info("s3_get_ok key=%s bytes=%s", key, len(resp.content))
            return resp.content
    except Exception:                
        logger.warning("s3_get_failed key=%s host=%s", key, urlparse(endpoint).hostname)
        raise

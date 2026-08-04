"""Celery application — configure once, import everywhere."""
from celery import Celery

from config import settings

app = Celery(
    "workers",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.health"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

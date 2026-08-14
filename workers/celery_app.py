"""Celery application — configure once, import everywhere."""
from celery import Celery
from celery.schedules import crontab

from config import settings

app = Celery(
    "workers",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "tasks.health",
        "tasks.collect_source",
        "tasks.collect_bridge",
        "tasks.normalize_jobs",
        "tasks.match_score",
        "tasks.generate_docs",
        "tasks.submit_application",
        "tasks.monitor_email",
        "tasks.enrich_company",
        "tasks.reindex_cv",
        "tasks.weekly_digest",
    ],
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
    beat_schedule={
        "weekly-digest-hourly": {
            "task": "tasks.weekly_digest",
            "schedule": crontab(minute=5),
        },
    },
)

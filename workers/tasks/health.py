"""Health check tasks — used to verify worker + broker connectivity."""
from celery_app import app


@app.task(name="tasks.health.ping", bind=True, max_retries=0)
def ping(self) -> str:  # noqa: ARG002
    """Return 'pong' — the simplest alive signal."""
    return "pong"

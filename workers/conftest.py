"""pytest configuration for workers — run all tasks eagerly (no broker needed)."""
import pytest


@pytest.fixture(autouse=True)
def celery_eager():
    """Force synchronous task execution so tests need no Redis."""
    from celery_app import app

    app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
        broker_url="memory://",
        result_backend="cache+memory://",
    )
    yield
    app.conf.update(
        task_always_eager=False,
        broker_url=None,
        result_backend=None,
    )

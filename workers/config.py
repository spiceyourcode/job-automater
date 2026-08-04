"""Env configuration for workers — loaded once at import time."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).parent.parent
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    openai_api_key: str = ""
    database_url: str = (
        "postgresql://jobautomater:jobautomater@127.0.0.1:5432/jobautomater"
    )
    # When True, skip real browser and write a synthetic proof PNG (tests/dev).
    submit_dry_run: bool = True
    s3_endpoint: str = "http://127.0.0.1:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "jobautomater"
    s3_region: str = "us-east-1"


settings = Settings()

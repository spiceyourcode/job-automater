"""Email classifier agent — map recruiter emails to application status."""

from agents.email_classifier.graph import run_email_classifier
from agents.email_classifier.schema import (
    AUTO_UPDATE_THRESHOLDS,
    Classification,
    meets_auto_threshold,
)

__all__ = [
    "run_email_classifier",
    "Classification",
    "meets_auto_threshold",
    "AUTO_UPDATE_THRESHOLDS",
]

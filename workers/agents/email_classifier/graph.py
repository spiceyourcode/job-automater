"""LangGraph email_classifier — classify → threshold gate → apply."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.email_classifier.heuristic import classify_email, match_application
from agents.email_classifier.schema import (
    CATEGORY_STATUS,
    CLASSIFIER_VERSION,
    Classification,
    meets_auto_threshold,
)

logger = logging.getLogger(__name__)


class EmailState(TypedDict, total=False):
    subject: str | None
    snippet: str | None
    from_email: str | None
    applications: list[dict[str, Any]]
    classification: dict[str, Any]
    application_id: str | None
    auto_apply: bool
    new_status: str | None
    notify: bool


def _classify_node(state: EmailState) -> dict[str, Any]:
    result = classify_email(
        subject=state.get("subject"),
        snippet=state.get("snippet"),
        from_email=state.get("from_email"),
    )
    try:
        from agents.email_classifier.llm import llm_classify_email

        llm = llm_classify_email(
            subject=state.get("subject"),
            snippet=state.get("snippet"),
        )
        if llm is not None:
            result = llm
    except Exception:  # noqa: BLE001
        pass
    return {"classification": result.model_dump(mode="json")}


def _match_node(state: EmailState) -> dict[str, Any]:
    app_id = match_application(
        subject=state.get("subject"),
        from_email=state.get("from_email"),
        applications=state.get("applications") or [],
    )
    return {"application_id": app_id}


def _gate_node(state: EmailState) -> dict[str, Any]:
    raw = state.get("classification") or {}
    classification = Classification.model_validate(raw)
    auto = meets_auto_threshold(classification.category, classification.confidence)
    new_status = CATEGORY_STATUS.get(classification.category) if auto else None
    # follow_up / spam / other never change status even if above threshold
    if classification.category in ("follow_up_request", "spam", "other"):
        new_status = None
    notify = auto and classification.category in (
        "interview_invitation",
        "offer",
        "rejection",
        "application_confirmation",
    )
    if not auto:
        logger.info(
            "email_below_threshold category=%s confidence=%s",
            classification.category,
            classification.confidence,
        )
    return {
        "auto_apply": bool(auto and new_status and state.get("application_id")),
        "new_status": new_status if auto else None,
        "notify": notify and bool(state.get("application_id")),
    }


def build_graph() -> Any:
    graph = StateGraph(EmailState)
    graph.add_node("classify", _classify_node)
    graph.add_node("match", _match_node)
    graph.add_node("gate", _gate_node)
    graph.add_edge(START, "classify")
    graph.add_edge("classify", "match")
    graph.add_edge("match", "gate")
    graph.add_edge("gate", END)
    return graph.compile()


def run_email_classifier(
    *,
    subject: str | None,
    snippet: str | None,
    from_email: str | None,
    applications: list[dict[str, Any]],
) -> dict[str, Any]:
    out = build_graph().invoke(
        {
            "subject": subject,
            "snippet": snippet,
            "from_email": from_email,
            "applications": applications,
        }
    )
    return {
        "classification": out.get("classification"),
        "application_id": out.get("application_id"),
        "auto_apply": out.get("auto_apply", False),
        "new_status": out.get("new_status"),
        "notify": out.get("notify", False),
        "classifier_version": CLASSIFIER_VERSION,
    }

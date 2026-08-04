"""LangGraph submit_verify — approve gate → portal submit → screenshot proof."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.submit_verify.portal import SubmitFn, default_submitter
from agents.submit_verify.schema import SubmitResult

logger = logging.getLogger(__name__)


class SubmitState(TypedDict, total=False):
    application: dict[str, Any]
    job: dict[str, Any]
    approved_at: str
    result: dict[str, Any] | None
    error: str | None


def _gate_node(state: SubmitState) -> dict[str, Any]:
    """HG-4: refuse submit without approved_at on payload and row."""
    app = state.get("application") or {}
    payload_approved = state.get("approved_at")
    row_approved = app.get("approved_at")
    if not payload_approved:
        logger.warning("submit_gate_rejected reason=missing_payload_approved_at")
        return {"error": "missing_approved_at", "result": None}
    if row_approved is None:
        logger.warning("submit_gate_rejected reason=missing_row_approved_at")
        return {"error": "not_approved", "result": None}
    status = str(app.get("status") or "")
    if status not in ("approved", "pending_approval"):
        logger.warning("submit_gate_rejected reason=bad_status status=%s", status)
        return {"error": "invalid_status", "result": None}
    return {"error": None}


def _submit_node(state: SubmitState, submit_fn: SubmitFn) -> dict[str, Any]:
    if state.get("error"):
        return {}
    result = submit_fn(state["application"], state["job"])
    # Never log CV / form field values (HG-8)
    logger.info(
        "submit_verify_result status=%s via=%s",
        result.status,
        result.submitted_via,
    )
    return {"result": result.model_dump(mode="python"), "error": result.error}


def build_graph(submit_fn: SubmitFn | None = None) -> Any:
    fn = submit_fn or default_submitter()

    def submit_node(state: SubmitState) -> dict[str, Any]:
        return _submit_node(state, fn)

    graph = StateGraph(SubmitState)
    graph.add_node("gate", _gate_node)
    graph.add_node("submit", submit_node)
    graph.add_edge(START, "gate")
    graph.add_edge("gate", "submit")
    graph.add_edge("submit", END)
    return graph.compile()


def run_submit_verify(
    *,
    application: dict[str, Any],
    job: dict[str, Any],
    approved_at: str,
    submit_fn: SubmitFn | None = None,
) -> SubmitResult | None:
    compiled = build_graph(submit_fn)
    out = compiled.invoke(
        {
            "application": application,
            "job": job,
            "approved_at": approved_at,
        }
    )
    if out.get("error") and not out.get("result"):
        return SubmitResult(status="error", error=out["error"])
    raw = out.get("result")
    if not raw:
        return SubmitResult(status="error", error="empty_result")
    return SubmitResult.model_validate(raw)

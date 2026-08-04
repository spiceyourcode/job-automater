"""LangGraph generate_docs — load chunks → generate → validate grounding (HG-9)."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.generate_docs.heuristic import generate_from_chunks
from agents.generate_docs.schema import (
    assert_grounded_in_chunks,
    validate_generated,
)

logger = logging.getLogger(__name__)


class DocsState(TypedDict, total=False):
    chunks: list[dict[str, Any]]
    job: dict[str, Any]
    profile: dict[str, Any] | None
    draft: dict[str, Any]
    validated: dict[str, Any] | None
    error: str | None


def _generate_node(state: DocsState) -> dict[str, Any]:
    draft = generate_from_chunks(
        chunks=state["chunks"],
        job=state["job"],
        profile=state.get("profile"),
    )
    # Never log document bodies (HG-8)
    logger.info(
        "generate_docs_draft traces=%s model=%s",
        len(draft.get("bullet_traces") or []),
        draft.get("model_used"),
    )
    return {"draft": draft, "error": None}


def _validate_node(state: DocsState) -> dict[str, Any]:
    draft = state.get("draft")
    if not draft:
        return {"validated": None, "error": "missing_draft"}
    try:
        docs = validate_generated(draft)
        assert_grounded_in_chunks(docs, state["chunks"])
        return {"validated": docs.model_dump(mode="json"), "error": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("generate_docs_validate_failed err=%s", type(exc).__name__)
        return {"validated": None, "error": f"{type(exc).__name__}: grounding failed"}


def build_graph():
    g = StateGraph(DocsState)
    g.add_node("generate", _generate_node)
    g.add_node("validate", _validate_node)
    g.add_edge(START, "generate")
    g.add_edge("generate", "validate")
    g.add_edge("validate", END)
    return g.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def run_generate_docs(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Returns validated docs dict or None if HG-9 validation fails."""
    result = get_graph().invoke(
        {"chunks": chunks, "job": job, "profile": profile}
    )
    return result.get("validated")

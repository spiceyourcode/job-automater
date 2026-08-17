"""LangGraph extract_normalize — raw → validated NormalizedJob."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.extract_normalize.heuristic import extract_heuristic
from agents.extract_normalize.schema import NormalizedJob, validate_normalized
from lib.llm import has_chat_provider

logger = logging.getLogger(__name__)


class ExtractState(TypedDict, total=False):
    raw_data: dict[str, Any]
    source_type: str
    source_external_id: str | None
    source_url: str | None
    draft: dict[str, Any]
    validated: dict[str, Any] | None
    error: str | None
    use_llm: bool


def _extract_node(state: ExtractState) -> dict[str, Any]:
    """Prefer heuristic; optional LLM when configured (still must validate)."""
    use_llm = bool(state.get("use_llm")) and has_chat_provider()
    draft = extract_heuristic(
        state["raw_data"],
        source_type=state.get("source_type") or "unknown",
        source_external_id=state.get("source_external_id"),
        source_url=state.get("source_url"),
    )
    if use_llm:
        # LLM path is opt-in; invalid JSON/schema falls back to heuristic (never persist unvalidated).
        try:
            from agents.extract_normalize.llm import llm_refine

            refined = llm_refine(state["raw_data"], draft)
            validate_normalized(refined)
            draft = refined
        except Exception:  # noqa: BLE001
            logger.warning("extract_llm_fallback source_type=%s", state.get("source_type"))
    return {"draft": draft, "error": None}


def _validate_node(state: ExtractState) -> dict[str, Any]:
    draft = state.get("draft") or {}
    try:
        job = validate_normalized(draft)
        return {"validated": job.model_dump(mode="json"), "error": None}
    except Exception as exc:  # noqa: BLE001 — surface as graph error, never persist
        logger.warning("extract_validate_failed err=%s", type(exc).__name__)
        return {"validated": None, "error": f"{type(exc).__name__}: validation failed"}


def build_graph():
    graph = StateGraph(ExtractState)
    graph.add_node("extract", _extract_node)
    graph.add_node("validate", _validate_node)
    graph.add_edge(START, "extract")
    graph.add_edge("extract", "validate")
    graph.add_edge("validate", END)
    return graph.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def run_extract_normalize(
    *,
    raw_data: dict[str, Any],
    source_type: str,
    source_external_id: str | None = None,
    source_url: str | None = None,
    use_llm: bool = False,
) -> NormalizedJob | None:
    """
    Run the graph. Returns NormalizedJob only if validation passed.
    Callers must not persist when None (HG-9).
    """
    result = get_graph().invoke(
        {
            "raw_data": raw_data,
            "source_type": source_type,
            "source_external_id": source_external_id,
            "source_url": source_url,
            "use_llm": use_llm,
        }
    )
    validated = result.get("validated")
    if not validated:
        return None
    return NormalizedJob.model_validate(validated)

"""LangGraph interview prep — heuristic first, LLM if grounded (HG-9)."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.interview_prep.heuristic import generate_prep_heuristic
from agents.interview_prep.llm import llm_generate_prep
from agents.interview_prep.schema import assert_star_grounded, validate_prep

logger = logging.getLogger(__name__)


class PrepState(TypedDict, total=False):
    chunks: list[dict[str, Any]]
    job: dict[str, Any]
    profile: dict[str, Any] | None
    draft: dict[str, Any]
    validated: dict[str, Any] | None
    error: str | None


def _generate_node(state: PrepState) -> dict[str, Any]:
    heuristic = generate_prep_heuristic(
        chunks=state["chunks"],
        job=state["job"],
        profile=state.get("profile"),
    )
    draft = heuristic
    llm_draft = llm_generate_prep(
        chunks=state["chunks"],
        job=state["job"],
        profile=state.get("profile"),
    )
    if llm_draft:
        try:
            pack = validate_prep(llm_draft)
            assert_star_grounded(pack, state["chunks"])
            draft = pack.model_dump(mode="json")
        except Exception:  # noqa: BLE001
            logger.warning("interview_prep_llm_ungrounded_fallback")
            draft = heuristic
    logger.info(
        "interview_prep_draft questions=%s stories=%s model=%s",
        len(draft.get("questions") or []),
        len(draft.get("star_stories") or []),
        draft.get("model_used"),
    )
    return {"draft": draft, "error": None}


def _validate_node(state: PrepState) -> dict[str, Any]:
    draft = state.get("draft")
    if not draft:
        return {"validated": None, "error": "missing_draft"}
    try:
        pack = validate_prep(draft)
        assert_star_grounded(pack, state["chunks"])
        return {"validated": pack.model_dump(mode="json"), "error": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("interview_prep_validate_failed err=%s", type(exc).__name__)
        return {"validated": None, "error": f"{type(exc).__name__}: grounding failed"}


def build_graph():
    g = StateGraph(PrepState)
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


def run_interview_prep(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
    profile: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    result = get_graph().invoke(
        {
            "chunks": chunks,
            "job": job,
            "profile": profile,
        }
    )
    return result.get("validated")

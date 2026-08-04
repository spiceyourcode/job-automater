"""LangGraph match_score — dedup → score → validate (reasoning required)."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.match_score.dedup import find_duplicate_of
from agents.match_score.schema import validate_match_score
from agents.match_score.scoring import compute_match_score
from agents.match_score.vector_search import hits_to_skill_hints, search_cv_chunks

logger = logging.getLogger(__name__)


class MatchState(TypedDict, total=False):
    user_id: str
    profile: dict[str, Any]
    job: dict[str, Any]
    existing_jobs: list[dict[str, Any]]
    conn: Any
    duplicate_of: str | None
    skip_score: bool
    vector_hits: list[str]
    draft: dict[str, Any]
    validated: dict[str, Any] | None
    error: str | None


def _dedup_node(state: MatchState) -> dict[str, Any]:
    job = state["job"]
    if job.get("is_duplicate"):
        return {"duplicate_of": job.get("duplicate_of"), "skip_score": True}
    dup = find_duplicate_of(job, state.get("existing_jobs") or [])
    if dup:
        return {"duplicate_of": dup, "skip_score": True}
    return {"duplicate_of": None, "skip_score": False}


def _score_node(state: MatchState) -> dict[str, Any]:
    if state.get("skip_score"):
        return {"draft": None, "error": None}
    hints: list[str] = []
    conn = state.get("conn")
    if conn is not None:
        hits = search_cv_chunks(
            conn,
            user_id=state["user_id"],
            query_text=str(state["job"].get("title") or "")
            + " "
            + str(state["job"].get("description") or ""),
        )
        hints = hits_to_skill_hints(hits)
    draft = compute_match_score(
        state["profile"],
        state["job"],
        vector_hits=hints or None,
    )
    return {"draft": draft, "vector_hits": hints, "error": None}


def _validate_node(state: MatchState) -> dict[str, Any]:
    if state.get("skip_score"):
        return {"validated": None, "error": None}
    draft = state.get("draft")
    if not draft:
        return {"validated": None, "error": "missing draft"}
    try:
        scored = validate_match_score(draft)
        # FAILURE gate: reasoning must be present (schema enforces)
        return {"validated": scored.model_dump(mode="json"), "error": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("match_validate_failed err=%s", type(exc).__name__)
        return {"validated": None, "error": f"{type(exc).__name__}: validation failed"}


def build_graph():
    g = StateGraph(MatchState)
    g.add_node("dedup", _dedup_node)
    g.add_node("score", _score_node)
    g.add_node("validate", _validate_node)
    g.add_edge(START, "dedup")
    g.add_edge("dedup", "score")
    g.add_edge("score", "validate")
    g.add_edge("validate", END)
    return g.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


def run_match_score(
    *,
    user_id: str,
    profile: dict[str, Any],
    job: dict[str, Any],
    existing_jobs: list[dict[str, Any]] | None = None,
    conn: Any = None,
) -> dict[str, Any]:
    """
    Returns {
      duplicate_of: str|None,
      score: MatchScore dict|None,
      error: str|None
    }
    """
    result = get_graph().invoke(
        {
            "user_id": user_id,
            "profile": profile,
            "job": job,
            "existing_jobs": existing_jobs or [],
            "conn": conn,
        }
    )
    return {
        "duplicate_of": result.get("duplicate_of"),
        "score": result.get("validated"),
        "error": result.get("error"),
    }

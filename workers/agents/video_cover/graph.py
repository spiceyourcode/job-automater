"""LangGraph video cover script — heuristic only, HG-9 grounded."""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.video_cover.heuristic import generate_video_script_heuristic
from agents.video_cover.schema import assert_script_grounded, validate_video_cover

logger = logging.getLogger(__name__)


class VideoState(TypedDict, total=False):
    chunks: list[dict[str, Any]]
    job: dict[str, Any]
    draft: dict[str, Any]
    validated: dict[str, Any] | None
    error: str | None


def _generate_node(state: VideoState) -> dict[str, Any]:
    draft = generate_video_script_heuristic(
        chunks=state["chunks"],
        job=state["job"],
    )
    logger.info(
        "video_cover_draft seconds=%s chunks=%s",
        draft.get("estimated_seconds"),
        len(draft.get("chunk_ids") or []),
    )
    return {"draft": draft, "error": None}


def _validate_node(state: VideoState) -> dict[str, Any]:
    draft = state.get("draft")
    if not draft:
        return {"validated": None, "error": "missing_draft"}
    try:
        pack = validate_video_cover(draft)
        assert_script_grounded(pack, state["chunks"])
        return {"validated": pack.model_dump(mode="json"), "error": None}
    except Exception as exc:  # noqa: BLE001
        logger.warning("video_cover_validate_failed err=%s", type(exc).__name__)
        return {"validated": None, "error": f"{type(exc).__name__}: grounding failed"}


def build_graph():
    g = StateGraph(VideoState)
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


def run_video_cover(
    *,
    chunks: list[dict[str, Any]],
    job: dict[str, Any],
) -> dict[str, Any] | None:
    result = get_graph().invoke({"chunks": chunks, "job": job})
    return result.get("validated")

"""LangGraph definition for Hilbert.

Verification pipeline is sequential: synthesis → verifier → reviewer → writer.
This ensures the reviewer sees confidence scores from the verifier before
checking for unsupported claims and coverage gaps.
"""

from typing import Any, Callable, Dict, List, Optional

from langgraph.graph import StateGraph, START, END

from hilbert.nodes import (
    planner_node,
    search_node,
    merger_node,
    synthesis_node,
    contradiction_node,
    reviewer_node,
    verifier_node,
    writer_node,
)
from hilbert.nodes.hypothesis import hypothesis_node
from hilbert.state.research import ResearchState, create_initial_state


def should_continue_search(state: ResearchState) -> List[str]:
    """Route to planner for another round or proceed to synthesis."""
    if state["status"] == "searching" and state["round"] < state["max_rounds"]:
        return ["planner"]
    return ["synthesis"]


def create_research_graph():
    """Create the LangGraph research workflow.

    Flow:
      START → planner → search → merger
                 ↑          ↓ (loop if rounds remain)
                 └──────────┘
      merger → synthesis → verifier → reviewer → writer → END
    """
    graph = StateGraph(ResearchState)

    graph.add_node("planner", planner_node)
    graph.add_node("search", search_node)
    graph.add_node("merger", merger_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("contradiction", contradiction_node)  # detects conflicting claims
    graph.add_node("verifier", verifier_node)            # assigns confidence scores
    graph.add_node("reviewer", reviewer_node)            # sees verified + contradiction data
    graph.add_node("writer", writer_node)
    graph.add_node("hypothesis", hypothesis_node)        # generates novel research questions

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "search")
    graph.add_edge("search", "merger")

    graph.add_conditional_edges(
        "merger",
        should_continue_search,
        ["planner", "synthesis"],
    )

    # synthesis → contradiction → verifier → reviewer → writer
    graph.add_edge("synthesis", "contradiction")
    graph.add_edge("contradiction", "verifier")
    graph.add_edge("verifier", "reviewer")
    graph.add_edge("reviewer", "writer")
    graph.add_edge("writer", "hypothesis")
    graph.add_edge("hypothesis", END)

    return graph.compile()


_graph = None


def get_research_graph():
    """Get (or lazily create) the compiled research graph."""
    global _graph
    if _graph is None:
        _graph = create_research_graph()
    return _graph


async def run_research(
    query: str,
    max_rounds: int = 3,
    progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    incremental: bool = False,
    session_id: Optional[str] = None,
):
    """Run a full research workflow and return the final state.

    Args:
        query: Research query.
        max_rounds: Number of research rounds.
        progress_callback: Optional callback for progress updates.
        incremental: If True, resume from prior session to fetch only new papers.
        session_id: Session ID to resume (required if incremental=True).
    """
    from hilbert.persistence.manager import get_session_manager

    initial_state: ResearchState

    if incremental and session_id:
        manager = get_session_manager()
        checkpoint = manager.get_latest_checkpoint(session_id)
        if checkpoint:
            checkpoint["incremental_since"] = checkpoint.get("started_at")
            checkpoint["prior_session_id"] = session_id
            checkpoint["progress_callback"] = progress_callback
            initial_state = checkpoint
        else:
            initial_state = create_initial_state(
                query, max_rounds=max_rounds, progress_callback=progress_callback
            )
    else:
        initial_state = create_initial_state(
            query, max_rounds=max_rounds, progress_callback=progress_callback
        )

    graph = get_research_graph()
    result = await graph.ainvoke(initial_state)
    return result
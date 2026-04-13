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
    reviewer_node,
    verifier_node,
    writer_node,
)
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
    graph.add_node("verifier", verifier_node)   # runs first: assigns confidence scores
    graph.add_node("reviewer", reviewer_node)   # runs second: sees verified findings
    graph.add_node("writer", writer_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "search")
    graph.add_edge("search", "merger")

    graph.add_conditional_edges(
        "merger",
        should_continue_search,
        ["planner", "synthesis"],
    )

    # Sequential verification chain (was parallel before)
    graph.add_edge("synthesis", "verifier")
    graph.add_edge("verifier", "reviewer")
    graph.add_edge("reviewer", "writer")
    graph.add_edge("writer", END)

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
):
    """Run a full research workflow and return the final state."""
    graph = get_research_graph()
    initial_state = create_initial_state(
        query, max_rounds=max_rounds, progress_callback=progress_callback
    )
    result = await graph.ainvoke(initial_state)
    return result
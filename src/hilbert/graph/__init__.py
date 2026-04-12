"""LangGraph definition for Hilbert."""

from typing import List

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
    """Determine if we should continue searching or proceed to synthesis."""
    if state["status"] == "searching" and state["round"] < state["max_rounds"]:
        return ["planner"]
    return ["synthesis"]


def create_research_graph():
    """Create the LangGraph research workflow."""
    graph = StateGraph(ResearchState)

    graph.add_node("planner", planner_node)
    graph.add_node("search", search_node)
    graph.add_node("merger", merger_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_node("verifier", verifier_node)
    graph.add_node("writer", writer_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "search")
    graph.add_edge("search", "merger")

    graph.add_conditional_edges(
        "merger",
        should_continue_search,
        ["planner", "synthesis"],
    )

    graph.add_edge("synthesis", "reviewer")
    graph.add_edge("synthesis", "verifier")
    graph.add_edge("reviewer", "writer")
    graph.add_edge("verifier", "writer")
    graph.add_edge("writer", END)

    return graph.compile()


_graph = None


def get_research_graph():
    """Get research graph singleton."""
    global _graph
    if _graph is None:
        _graph = create_research_graph()
    return _graph


async def run_research(query: str, max_rounds: int = 3):
    """Run a research workflow."""
    graph = get_research_graph()
    initial_state = create_initial_state(query, max_rounds)
    result = await graph.ainvoke(initial_state)
    return result
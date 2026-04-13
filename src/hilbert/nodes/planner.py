"""Planner node for Hilbert."""

from hilbert.llm import get_client, get_planner_prompt, get_dimensions_fallback
from hilbert.llm.utils import parse_json_object
from hilbert.state.research import ResearchState


async def planner_node(state: ResearchState) -> dict:
    """Decompose query into sub-questions and four research dimensions."""
    query = state["query"]
    max_rounds = state["max_rounds"]
    n = max(max_rounds * 2, 4)

    callback = state.get("progress_callback")
    if callback:
        callback("planner", {"status": "planning", "query": query})

    system_prompt, user_prompt = get_planner_prompt(query, n=n)

    sub_questions = [query]
    dimensions = get_dimensions_fallback(query)

    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        parsed = parse_json_object(content)
        if parsed:
            qs = parsed.get("sub_questions", [])
            dims = parsed.get("dimensions", [])
            if qs:
                sub_questions = [str(q) for q in qs]
            if dims and len(dims) == 4:
                dimensions = dims

    except Exception:
        pass  # keep fallbacks

    return {
        "sub_questions": sub_questions,
        "research_dimensions": dimensions,
        "round": 1,
        "status": "searching",
    }


def create_planner_node():
    """Create planner node function."""
    return planner_node
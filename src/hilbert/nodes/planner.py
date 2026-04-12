"""Planner node for Hilbert."""

import uuid
from typing import List

from hilbert.llm import get_client, get_planner_prompt
from hilbert.llm.utils import parse_json_list
from hilbert.state.research import ResearchState


async def planner_node(state: ResearchState) -> dict:
    """Decompose query into N sub-questions."""
    query = state["query"]
    max_rounds = state["max_rounds"]
    n = max_rounds * 1

    system_prompt, user_prompt = get_planner_prompt(query, n=n)

    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        sub_questions = parse_json_list(content)

        if not sub_questions:
            sub_questions = [query]

    except Exception as e:
        sub_questions = [query]

    return {
        "sub_questions": sub_questions,
        "round": 1,
        "status": "searching",
    }


def create_planner_node():
    """Create planner node function."""
    return planner_node
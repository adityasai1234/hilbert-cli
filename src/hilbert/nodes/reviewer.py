"""Reviewer node for Hilbert."""

import uuid
from typing import List

from hilbert.llm import get_client, get_reviewer_prompt
from hilbert.llm.utils import parse_json_object
from hilbert.models import Gap
from hilbert.state.research import ResearchState


async def reviewer_node(state: ResearchState) -> dict:
    """Check coverage and identify gaps."""
    query = state["query"]
    sub_questions = state.get("sub_questions", [])
    findings = state.get("findings", [])

    system_prompt, user_prompt = get_reviewer_prompt(
        query=query,
        sub_questions=sub_questions,
        findings=[f.model_dump() for f in findings],
    )

    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        gap_data = parse_json_object(content)
        gap_list = gap_data.get("gaps", []) if gap_data else []

        gaps = []
        for gd in gap_list:
            gap = Gap(
                gap_id=f"gap-{uuid.uuid4().hex[:8]}",
                description=gd.get("description", ""),
                severity=gd.get("severity", "minor"),
            )
            gaps.append(gap)

    except Exception:
        gaps = []

    return {
        "gaps": gaps,
        "status": "verifying",
    }


def create_reviewer_node():
    """Create reviewer node function."""
    return reviewer_node
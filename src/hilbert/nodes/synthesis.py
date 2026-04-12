"""Synthesis node for Hilbert."""

import uuid
from typing import List

from hilbert.llm import get_client, get_synthesis_prompt
from hilbert.llm.utils import parse_json_list
from hilbert.models import Finding, Paper
from hilbert.state.research import ResearchState


async def synthesis_node(state: ResearchState) -> dict:
    """Extract findings from top papers."""
    query = state["query"]
    papers = state.get("papers", [])

    if not papers:
        return {
            "findings": [],
            "status": "reviewing",
        }

    paper_data = []
    for paper in papers[:10]:
        paper_data.append({
            "paper_id": paper.paper_id,
            "title": paper.title,
            "abstract": paper.abstract,
        })

    system_prompt, user_prompt = get_synthesis_prompt(query, paper_data)

    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        findings_data = parse_json_list(content)

        findings = []
        for fd in findings_data:
            finding = Finding(
                finding_id=f"finding-{uuid.uuid4().hex[:8]}",
                claim=fd.get("claim", ""),
                source_paper_id=fd.get("source_paper_id", ""),
                evidence_text=fd.get("evidence_text", ""),
            )
            findings.append(finding)

    except Exception as e:
        findings = []

    return {
        "findings": findings,
        "status": "reviewing",
    }


def create_synthesis_node():
    """Create synthesis node function."""
    return synthesis_node
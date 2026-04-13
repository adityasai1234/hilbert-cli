"""Hypothesis node for Hilbert — generates novel research questions from findings."""

import uuid
from typing import List

from hilbert.llm import get_client, get_hypothesis_prompt
from hilbert.llm.utils import parse_json_list
from hilbert.models.hypothesis import Hypothesis
from hilbert.state.research import ResearchState


async def hypothesis_node(state: ResearchState) -> dict:
    """Generate 3-5 novel hypotheses from verified findings."""
    query = state["query"]
    findings = state.get("findings", [])

    callback = state.get("progress_callback")
    if callback:
        callback("hypothesis", {"findings": len(findings)})

    findings_data = [
        {
            "finding_id": f.finding_id,
            "claim": f.claim,
            "confidence": round(f.confidence, 3),
            "is_verified": f.is_verified,
        }
        for f in findings
    ]

    system_prompt, user_prompt = get_hypothesis_prompt(
        query=query,
        findings=findings_data,
    )

    hypotheses: List[Hypothesis] = []
    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        hyp_list = parse_json_list(content) or []
        for h in hyp_list:
            if not isinstance(h, dict) or not h.get("text"):
                continue
            hypotheses.append(
                Hypothesis(
                    hypothesis_id=f"hyp-{uuid.uuid4().hex[:8]}",
                    text=h.get("text", ""),
                    basis=h.get("basis", ""),
                    related_finding_ids=h.get("related_finding_ids", []),
                    confidence=float(h.get("confidence", 0.5)),
                )
            )
    except Exception:
        pass  # non-fatal — report still useful without hypotheses

    if callback:
        callback("hypothesis", {"generated": len(hypotheses)})

    return {"hypotheses": hypotheses}


def create_hypothesis_node():
    """Create hypothesis node function."""
    return hypothesis_node

"""Reviewer node for Hilbert — integrity commandments + severity grading."""

import uuid
from typing import List

from hilbert.llm import get_client, get_reviewer_prompt
from hilbert.llm.utils import parse_json_object
from hilbert.models import Gap
from hilbert.state.research import ResearchState

# Canonical severity values accepted in the Gap model
_VALID_SEVERITIES = {"FATAL", "MAJOR", "MINOR", "minor", "major", "critical"}
_SEVERITY_MAP = {"critical": "FATAL", "major": "MAJOR", "minor": "MINOR"}


def _normalise_severity(raw: str) -> str:
    raw = raw.upper()
    return _SEVERITY_MAP.get(raw.lower(), raw) if raw not in ("FATAL", "MAJOR", "MINOR") else raw


async def reviewer_node(state: ResearchState) -> dict:
    """Apply integrity rules to verified findings and report gaps."""
    query = state["query"]
    sub_questions = state.get("sub_questions", [])
    findings = state.get("findings", [])

    callback = state.get("progress_callback")
    if callback:
        callback("reviewer", {"findings": len(findings)})

    # Pass full finding data including confidence + is_verified (set by verifier)
    findings_data = [
        {
            "finding_id": f.finding_id,
            "claim": f.claim,
            "source_paper_id": getattr(f, "source_paper_id", None),
            "confidence": round(f.confidence, 3),
            "is_verified": f.is_verified,
        }
        for f in findings
    ]

    contradictions = state.get("contradictions", [])
    contradictions_data = [
        {
            "claim_a": c.claim_a,
            "claim_b": c.claim_b,
            "similarity": round(c.similarity, 3),
            "description": c.description,
            "severity": c.severity_label(),
        }
        for c in contradictions
    ]

    system_prompt, user_prompt = get_reviewer_prompt(
        query=query,
        sub_questions=sub_questions,
        findings=findings_data,
        contradictions=contradictions_data,
    )

    gaps: List[Gap] = []
    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
        )

        gap_data = parse_json_object(content)
        gap_list = gap_data.get("gaps", []) if gap_data else []

        for gd in gap_list:
            severity_raw = gd.get("severity", "MINOR")
            gaps.append(Gap(
                gap_id=f"gap-{uuid.uuid4().hex[:8]}",
                description=gd.get("description", ""),
                severity=_normalise_severity(str(severity_raw)),
            ))

    except Exception:
        pass

    return {
        "gaps": gaps,
        "status": "writing",
    }


def create_reviewer_node():
    """Create reviewer node function."""
    return reviewer_node
"""Hypothesis node for Hilbert — generates novel research questions from findings."""

import uuid
from typing import List

from hilbert.config.settings import get_settings
from hilbert.llm import get_client, get_hypothesis_prompt
from hilbert.llm.utils import parse_json_list
from hilbert.models.hypothesis import Hypothesis
from hilbert.state.research import ResearchState


def _hypotheses_to_markdown(hypotheses: List[Hypothesis]) -> str:
    """Render hypotheses as a markdown section."""
    if not hypotheses:
        return ""
    lines = [
        "",
        "---",
        "",
        "## Open Hypotheses & Research Directions",
        "",
        "> *The following hypotheses were generated from the verified findings above.*",
        "> *They are speculative and intended to guide future investigation.*",
        "",
    ]
    for i, h in enumerate(hypotheses, start=1):
        conf_pct = int(h.confidence * 100)
        lines.append(f"**{i}. {h.text}**")
        if h.basis:
            lines.append(f"> *Basis:* {h.basis}")
        lines.append(f"> *Plausibility:* {conf_pct}%")
        lines.append("")
    return "\n".join(lines)


async def hypothesis_node(state: ResearchState) -> dict:
    """Generate 3-5 novel hypotheses from verified findings and append to report.md."""
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

    # Append to the report.md written by the writer node
    if hypotheses:
        settings = get_settings()
        report_path = settings.output_dir / "report.md"
        try:
            existing = report_path.read_text() if report_path.exists() else ""
            report_path.write_text(existing + _hypotheses_to_markdown(hypotheses))
        except Exception:
            pass

    if callback:
        callback("hypothesis", {"generated": len(hypotheses)})

    return {"hypotheses": hypotheses}


def create_hypothesis_node():
    """Create hypothesis node function."""
    return hypothesis_node

"""Writer node for Hilbert — inline citations + enriched provenance."""

import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from hilbert.config.settings import get_settings
from hilbert.llm import get_client, get_writer_prompt
from hilbert.models import Paper, Report
from hilbert.state.research import ResearchState


def _build_source_index(papers: List[Paper]) -> tuple[List[dict], Dict[str, str]]:
    """Build a 1-based numbered source list and a paper_id → citation number map."""
    source_data: List[dict] = []
    source_index: Dict[str, str] = {}  # paper_id → "1", "2", ...

    for i, paper in enumerate(papers[:20], start=1):
        num = str(i)
        source_data.append({
            "citation_number": num,
            "paper_id": paper.paper_id,
            "title": paper.title,
            "authors": [a.name for a in paper.authors],
            "published_date": str(paper.published_date) if paper.published_date else "n.d.",
            "url": str(paper.url) if paper.url else "",
            "doi": paper.doi or "",
            "venue": paper.venue or "",
        })
        source_index[paper.paper_id] = num

    return source_data, source_index


async def writer_node(state: ResearchState) -> dict:
    """Generate final research report with inline [N] citations."""
    settings = get_settings()

    query = state["query"]
    findings = state.get("findings", [])
    papers = state.get("papers", [])
    started_at: Optional[datetime] = state.get("started_at")
    gaps = state.get("gaps", [])
    contradictions = state.get("contradictions", [])

    callback = state.get("progress_callback")
    if callback:
        callback("writer", {"status": "writing"})

    source_data, source_index = _build_source_index(papers)

    findings_data = []
    for f in findings:
        findings_data.append({
            "finding_id": f.finding_id,
            "claim": f.claim,
            "confidence": f.confidence,
            "confidence_label": f.confidence_label(),
            "is_verified": f.is_verified,
            "source_paper_id": getattr(f, "source_paper_id", None),
            # Provide citation number directly so LLM can embed [N]
            "citation_number": source_index.get(getattr(f, "source_paper_id", ""), "?"),
        })

    system_prompt, user_prompt = get_writer_prompt(
        query=query,
        findings=findings_data,
        sources=source_data,
    )

    try:
        client = get_client()
        content = await client.complete_text(
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=4000,
        )
    except Exception:
        content = generate_fallback_report(query, findings, papers)

    bibtex = generate_bibtex(papers)

    # Build contradiction section if any were confirmed
    contradictions_md = ""
    if contradictions:
        lines = ["## Contradictions Detected\n",
                 "> The following claim pairs were identified as potentially contradicting each other.\n"]
        for c in contradictions:
            lines.append(
                f"- **{c.severity_label()}** — *\"{c.claim_a}\"* vs *\"{c.claim_b}\"*"
                + (f"\n  {c.description}" if c.description else "")
            )
        contradictions_md = "\n".join(lines)

    sections = {"summary": content}
    if contradictions_md:
        sections["contradictions"] = contradictions_md

    report = Report(
        report_id=f"report-{uuid.uuid4().hex[:8]}",
        title=query,
        query=query,
        executive_summary="",
        sections=sections,
        sources=source_data,
        source_index=source_index,
        findings_summary=findings_data,
        bibliography=bibtex,
        created_at=datetime.now(),
        status="final",
    )

    output_dir = settings.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    (output_dir / "report.md").write_text(report.to_markdown())
    (output_dir / "report.json").write_text(json.dumps(report.to_json(), indent=2))
    (output_dir / "report.bib").write_text(bibtex)

    provenance = generate_provenance(state, source_data, findings_data, gaps, started_at, contradictions)
    (output_dir / "report.provenance.md").write_text(provenance)

    return {
        "report": report,
        "status": "done",
    }


def generate_provenance(
    state: ResearchState,
    source_data: List[dict],
    findings_data: List[dict],
    gaps: List,
    started_at: Optional[datetime],
    contradictions: List = None,
) -> str:
    """Generate enriched provenance sidecar."""
    from hilbert.ui.mermaid import generate_research_mermaid
    from hilbert.config.settings import get_settings

    settings = get_settings()
    now = datetime.now()
    duration_s = int((now - started_at).total_seconds()) if started_at else 0

    verified_count = sum(1 for f in findings_data if f.get("is_verified"))
    fatal_gaps = [g for g in gaps if getattr(g, "severity", "") == "FATAL"]
    major_gaps = [g for g in gaps if getattr(g, "severity", "") == "MAJOR"]
    confirmed_contradictions = list(contradictions or [])

    dimensions = state.get("research_dimensions", [])
    dim_labels = [d.get("label", d.get("strategy", "?")) for d in dimensions]

    lines = [
        f"# Provenance: {state['query']}",
        "",
        "## Run metadata",
        f"- **Date:** {now.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Duration:** {duration_s}s",
        f"- **Model:** {settings.model}",
        f"- **Rounds completed:** {state.get('round', 1)} / {state['max_rounds']}"
        + (" *(converged early)*" if state.get("converged") else ""),
        f"- **Research dimensions:** {', '.join(dim_labels) or 'default'}",
        "",
        "## Source pipeline",
        f"- **Sources consulted (pre-dedup):** {state.get('papers_consulted', len(source_data))}",
        f"- **Sources accepted (post-filter):** {len(source_data)}",
        "",
        "## Findings",
        f"- **Total findings:** {len(findings_data)}",
        f"- **Verified (confidence ≥ {settings.confidence_threshold}):** {verified_count}",
        f"- **Unverified:** {len(findings_data) - verified_count}",
        "",
        "## Reviewer integrity check",
        f"- **FATAL gaps:** {len(fatal_gaps)}",
        f"- **MAJOR gaps:** {len(major_gaps)}",
        f"- **Confirmed contradictions:** {len(confirmed_contradictions)}",
    ]

    if confirmed_contradictions:
        lines.append("")
        lines.append("### Contradictions")
        for c in confirmed_contradictions:
            lines.append(f"- [{c.severity_label()}] {c.description or 'No description'}")

    if fatal_gaps or major_gaps:
        lines.append("")
        lines.append("### Gap details")
        for g in fatal_gaps + major_gaps:
            lines.append(f"- [{g.severity}] {g.description}")

    lines.extend([
        "",
        "## Sub-questions",
    ])
    for sq in state.get("sub_questions", []):
        lines.append(f"- {sq}")

    lines.extend([
        "",
        "## Workflow",
        generate_research_mermaid(),
    ])

    return "\n".join(lines)


def generate_fallback_report(query: str, findings: List, papers: List) -> str:
    """Generate fallback report if LLM fails."""
    lines = [
        f"# Research Report: {query}",
        "",
        "## Summary",
        f"Found {len(findings)} findings from {len(papers)} papers.",
    ]

    for f in findings:
        lines.append(f"- {f.claim}")

    return "\n".join(lines)


def generate_bibtex(papers: List[Paper]) -> str:
    """Generate BibTeX bibliography."""
    lines = []
    for paper in papers:
        bib = paper.to_bibtex()
        if bib:
            lines.append(bib)
            lines.append("")
    return "\n".join(lines)


def create_writer_node():
    """Create writer node function."""
    return writer_node
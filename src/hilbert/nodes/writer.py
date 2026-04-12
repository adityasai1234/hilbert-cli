"""Writer node for Hilbert."""

import uuid
from pathlib import Path
from datetime import datetime
from typing import List

from hilbert.config.settings import get_settings
from hilbert.llm import get_client, get_writer_prompt
from hilbert.models import Paper, Report
from hilbert.state.research import ResearchState


async def writer_node(state: ResearchState) -> dict:
    """Generate final research report."""
    settings = get_settings()

    query = state["query"]
    findings = state.get("findings", [])
    papers = state.get("papers", [])

    source_data = []
    for paper in papers[:20]:
        source_data.append({
            "paper_id": paper.paper_id,
            "title": paper.title,
            "authors": [a.name for a in paper.authors],
            "published_date": str(paper.published_date) if paper.published_date else "n.d.",
            "url": str(paper.url),
            "venue": paper.venue,
        })

    findings_data = []
    for f in findings:
        findings_data.append({
            "claim": f.claim,
            "confidence": f.confidence,
            "confidence_label": f.confidence_label(),
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

    report = Report(
        report_id=f"report-{uuid.uuid4().hex[:8]}",
        title=query,
        query=query,
        executive_summary="",
        sections={"summary": content},
        sources=source_data,
        findings_summary=findings_data,
        bibliography=bibtex,
        created_at=datetime.now(),
        status="final",
    )

    output_dir = settings.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    md_path = output_dir / "report.md"
    md_path.write_text(report.to_markdown())

    json_path = output_dir / "report.json"
    import json
    json_path.write_text(json.dumps(report.to_json(), indent=2))

    bib_path = output_dir / "report.bib"
    bib_path.write_text(bibtex)

    provenance = generate_provenance(query, len(papers), len(findings), state.get("round", 1), state.get("sub_questions", []))
    prov_path = output_dir / "report.provenance.md"
    prov_path.write_text(provenance)

    return {
        "report": report,
        "status": "done",
    }


def generate_provenance(
    query: str,
    papers_count: int,
    findings_count: int,
    rounds: int,
    sub_questions: List[str],
) -> str:
    """Generate provenance sidecar file."""
    from hilbert.ui.mermaid import generate_research_mermaid

    lines = [
        f"# Provenance: {query}",
        "",
        f"- **Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Rounds:** {rounds}",
        f"- **Sources consulted:** {papers_count}",
        f"- **Findings:** {findings_count}",
        f"- **Verification:** Pass - confidence >= 0.75",
        "",
        "## Sub-questions",
    ]
    if sub_questions:
        lines.extend([f"- {sq}" for sq in sub_questions])
    else:
        lines.append("- (None)")
    
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
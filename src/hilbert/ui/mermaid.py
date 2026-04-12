"""Mermaid diagram templates for Hilbert."""

from typing import List, Optional


def render_workflow_mermaid(
    query: str,
    rounds: int = 3,
    additional_nodes: Optional[List[str]] = None,
) -> str:
    """Render a Mermaid diagram showing the Hilbert workflow."""
    nodes = ["Query", "Planner", "Search", "Merger", "Synthesis", "Reviewer", "Verifier", "Writer"]

    if additional_nodes:
        nodes.extend(additional_nodes)

    lines = ["```mermaid", "graph TD", ""]

    for i, node in enumerate(nodes[:-1]):
        next_node = nodes[i + 1]
        lines.append(f"    {node}[{node}] --> {next_node}[{next_node}]")

    lines.extend([
        "",
        "    Writer[Writer] --> Output",
        "    Output(Output) --> report",
        "",
        "    style Query fill:#f9f,stroke:#333",
        "    style Output fill:#9f9,stroke:#333",
        "```",
    ])

    return "\n".join(lines)


def render_findings_mermaid(
    findings: List[dict],
) -> str:
    """Render findings as a Mermaid flowchart."""
    if not findings:
        return ""

    lines = ["```mermaid", "graph LR", ""]

    for i, f in enumerate(findings[:10]):
        claim = f.get("claim", "")[:30]
        confidence = f.get("confidence", 0)

        color = "#9f9" if confidence >= 0.75 else "#ff9" if confidence >= 0.5 else "#f99"

        lines.append(f"    F{i}[{claim}...] --> C{confidence:.0f}[conf:{confidence:.2f}]")

    lines.extend(["", "```"])
    return "\n".join(lines)


def render_sources_mermaid(
    sources: List[dict],
) -> str:
    """Render sources as a Mermaid class diagram."""
    if not sources:
        return ""

    lines = ["```mermaid", "classDiagram", ""]
    lines.append("    class Paper {")

    for s in sources[:5]:
        title = s.get("title", "Unknown")[:20]
        venue = s.get("venue", "arXiv")
        lines.append(f"        +{title}...")

    lines.extend(["    }", "", "```"])
    return "\n".join(lines)


def render_timeline(
    events: List[dict],
) -> str:
    """Render a timeline of research events."""
    if not events:
        return ""

    lines = ["```mermaid", "timeline", ""]

    for event in events:
        action = event.get("action", "Unknown")
        time = event.get("timestamp", "")
        details = event.get("details", "")[:40]

        lines.append(f"    {time}: {action}")

    lines.extend(["", "```"])
    return "\n".join(lines)


def render_research_flow(
    query: str,
    rounds: int,
    papers_per_round: List[int],
    findings_per_round: List[int],
) -> str:
    """Render the research flow with actual data."""
    lines = ["```mermaid", "flowchart TD", ""]
    lines.append("    Start((Query)) --> Planner")

    for r in range(1, rounds + 1):
        lines.append(f"    Planner --> Search{r}[Search Round {r}]")
        lines.append(f"    Search{r} --> Merger{r}[Merger]")
        lines.append(f"    Merger{r} -->|{papers_per_round[r-1]} papers| Decision{r}{d}")
        lines.append(f"    Decision{r}")
        if r < rounds:
            lines.append(f"    Decision{r} -->|continue| Planner")
        else:
            lines.append(f"    Decision{r} -->|done| Synthesis")

    lines.extend([
        "    Synthesis --> Reviewer",
        "    Reviewer --> Verifier",
        "    Verifier --> Writer",
        "    Writer --> End((Report))",
        "",
        "    style Start fill:#f9f",
        "    style End fill:#9f9",
        "```",
    ])

    return "\n".join(lines)


def generate_research_mermaid() -> str:
    """Generate a template Mermaid diagram for the research workflow."""
    return """```mermaid
graph TD
    Query(Query) --> Planner
    Planner --> Search[Search Agents]
    Search --> Merger
    Merger --> Synthesis[Synthesis]
    Synthesis --> Reviewer
    Reviewer --> Verifier
    Verifier --> Writer
    Writer --> Report[Report]
    
    subgraph Rounds
    Search -.->|round 1| Merger
    Search -.->|round 2| Merger
    Search -.->|round N| Merger
    end
    
    style Query fill:#f9f,stroke:#333
    style Report fill:#9f9,stroke:#333
```"""
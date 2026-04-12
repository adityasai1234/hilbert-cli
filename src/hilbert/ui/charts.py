"""ASCII charts for Hilbert terminal output."""

from typing import List, Optional


CHAR_COLORS = {
    "low": "▁▂▃▄▅▆▇█▇▆▅▄▃▂",
    "medium": " ▁▂▃▄▅▆▇█",
    "high": " ▂▃▄▅▆▇█",
}


def render_bar_chart(
    data: List[float],
    title: Optional[str] = None,
    width: int = 40,
    height: int = 10,
) -> str:
    """Render a simple ASCII bar chart."""
    if not data:
        return "No data to display"

    lines = []
    if title:
        lines.append(f"│ {title}")
        lines.append("├" + "─" * (width + 2) + "┤")

    max_val = max(data) if data else 1
    min_val = min(data) if data else 0

    for i in range(height, 0, -1):
        threshold = min_val + (max_val - min_val) * i / height
        bar = ""
        for val in data:
            filled = "█" if val >= threshold else " "
            bar += filled
        lines.append("│" + bar + "│")

    labels = [str(d) for d in data]
    label_line = "│" + " ".join(labels)[:width] + "│"
    lines.append("├" + "─" * (width + 2) + "┤")

    return "\n".join(lines)


def render_progress_bar(
    current: int,
    total: int,
    label: str = "",
    width: int = 30,
) -> str:
    """Render a progress bar."""
    if total == 0:
        return f"{label}: No progress"

    filled = int(width * current / total)
    bar = "█" * filled + " " * (width - filled)
    percent = int(100 * current / total)

    return f"{label}: [{bar}] {current}/{total} ({percent}%)"


def render_rounds_chart(
    rounds_data: List[dict],
) -> str:
    """Render a chart showing progress across rounds."""
    if not rounds_data:
        return "No round data"

    lines = ["Research Progress by Round", ""]

    for round_info in rounds_data:
        round_num = round_info.get("round", "?")
        papers = round_info.get("papers", 0)
        findings = round_info.get("findings", 0)

        paper_bar = "█" * min(papers, 20)
        finding_bar = "▓" * min(findings, 20)

        lines.append(f"  Round {round_num}:")
        lines.append(f"    Papers:   {paper_bar} {papers}")
        lines.append(f"    Findings:{finding_bar} {findings}")
        lines.append("")

    return "\n".join(lines)


def render_table(
    headers: List[str],
    rows: List[List[str]],
    title: Optional[str] = None,
) -> str:
    """Render a simple ASCII table."""
    if not rows:
        return "No data"

    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(col_widths):
                col_widths[i] = max(col_widths[i], len(str(cell)))

    lines = []

    if title:
        lines.append(title)
        lines.append("=" * len(title))

    header = " | ".join(
        h.ljust(col_widths[i]) for i, h in enumerate(headers)
    )
    lines.append(header)
    lines.append("-" * len(header))

    for row in rows:
        line = " | ".join(
            str(row[i]).ljust(col_widths[i]) if i < len(row) else ""
            for i in range(len(headers))
        )
        lines.append(line)

    return "\n".join(lines)


def render_stats_summary(
    papers_count: int,
    findings_count: int,
    rounds: int,
    verified_count: int = 0,
) -> str:
    """Render a summary statistics block."""
    return f"""
╔══════════════════════════════════════════╗
║      Research Summary             ║
╠══════════════════════════════════════════╣
║  Rounds completed:     {rounds:>3}          ║
║  Papers found:       {papers_count:>3}          ║
║  Findings:         {findings_count:>3}          ║
║  Verified:         {verified_count:>3}          ║
╚══════════════════════════════════════════╝
"""
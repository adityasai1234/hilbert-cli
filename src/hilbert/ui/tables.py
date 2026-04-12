"""Styled tables for Hilbert terminal UI."""

from typing import List, Optional
from rich import box
from rich.table import Table
from rich.text import Text


def create_deps_table(deps: dict) -> Table:
    """Create dependency status table."""
    table = Table(
        title="Dependencies",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
        title_style="bold cyan",
    )
    
    table.add_column("Package", style="cyan", width=15)
    table.add_column("Status", justify="center")
    
    for name, ok in deps.items():
        status = "[green]✓[/green]" if ok else "[red]✗[/red]"
        style = "green" if ok else "red"
        table.add_row(name, status, style=style)
    
    return table


def create_sessions_table(sessions: List[dict]) -> Table:
    """Create sessions list table."""
    table = Table(
        title="Sessions",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
        title_style="bold cyan",
    )
    
    table.add_column("ID", style="dim", width=20)
    table.add_column("Query", style="white", width=30)
    table.add_column("Status", style="cyan")
    table.add_column("Round", justify="center")
    
    for s in sessions:
        status_style = {
            "done": "green",
            "error": "red",
            "planning": "yellow",
        }.get(s.get("status", ""), "white")
        
        table.add_row(
            s.get("session_id", "")[:20],
            s.get("query", "")[:30],
            f"[{status_style}]{s.get('status', '')}[/{status_style}]",
            str(s.get("current_round", 0)),
        )
    
    return table


def create_findings_table(findings: List[dict], limit: int = 10) -> Table:
    """Create findings table with confidence."""
    table = Table(
        title="Findings",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    
    table.add_column("#", justify="center", width=4)
    table.add_column("Claim", style="white", width=40)
    table.add_column("Confidence", justify="center")
    table.add_column("Verified", justify="center")
    
    for i, f in enumerate(findings[:limit], 1):
        conf = f.get("confidence", 0)
        
        if conf >= 0.9:
            conf_style = "green"
            conf_text = f"[green]{conf:.2f}[/green]"
        elif conf >= 0.75:
            conf_style = "yellow"
            conf_text = f"[yellow]{conf:.2f}[/yellow]"
        else:
            conf_style = "red"
            conf_text = f"[red]{conf:.2f}[/red]"
        
        verified = "[green]✓[/green]" if f.get("is_verified") else "[red]○[/red]"
        
        claim = f.get("claim", "")[:37] + "..." if len(f.get("claim", "")) > 40 else f.get("claim", "")
        
        table.add_row(str(i), claim, conf_text, verified)
    
    return table


def create_papers_table(papers: List[dict], limit: int = 10) -> Table:
    """Create papers table."""
    table = Table(
        title="Papers",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    
    table.add_column("#", justify="center", width=4)
    table.add_column("Title", style="cyan", width=35)
    table.add_column("Authors", style="dim", width=15)
    table.add_column("Year", justify="center")
    
    for i, p in enumerate(papers[:limit], 1):
        title = p.get("title", "")[:32] + "..." if len(p.get("title", "")) > 35 else p.get("title", "")
        authors = ", ".join(p.get("authors", [])[:2])
        if len(p.get("authors", [])) > 2:
            authors += " et al."
        year = str(p.get("published_date", "n.d."))[:4]
        
        table.add_row(str(i), title, authors[:15], year)
    
    return table


def create_progress_table(
    rounds: List[dict],
    current_round: int,
    max_rounds: int,
) -> Table:
    """Create round progress table."""
    table = Table(
        title="Research Progress",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    
    table.add_column("Round", justify="center", width=8)
    table.add_column("Papers", justify="center")
    table.add_column("Findings", justify="center")
    table.add_column("Status", width=12)
    
    for r in rounds:
        round_num = r.get("round", 0)
        is_current = round_num == current_round
        
        status = "[green]done[/green]" if round_num < current_round else "[yellow]current[/yellow]" if is_current else "[dim]pending[/dim]"
        style = "bold green" if round_num < current_round else "bold yellow" if is_current else "dim"
        
        table.add_row(
            f"[{style}]Round {round_num}[/{style}]",
            str(r.get("papers", 0)),
            str(r.get("findings", 0)),
            status,
        )
    
    return table
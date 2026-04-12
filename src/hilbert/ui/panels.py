"""Rich terminal UI for Hilbert."""

from typing import Optional
from rich.console import Console
from rich.live import Live
from rich.layout import Layout
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich.text import Text


console = Console()


class HilbertPanels:
    """Terminal panels for Hilbert research session."""

    def __init__(self):
        self.progress = None
        self.live = None
        self.round_data = []
        self.search_agents = {}
        self.papers_fetched = 0
        self.findings_count = 0
        
    def update_search_agent(self, agent_id: str, status: str) -> None:
        """Update search agent progress."""
        self.search_agents[agent_id] = status
        
    def update_papers_count(self, count: int) -> None:
        """Update papers count."""
        self.papers_fetched = count
        
    def update_findings_count(self, count: int) -> None:
        """Update findings count."""
        self.findings_count = count
        
    def add_round_data(self, round_num: int, papers: int, findings: int) -> None:
        """Add round data."""
        self.round_data.append({
            "round": round_num,
            "papers": papers,
            "findings": findings,
        })
        
    def create_layout(self, query: str, round_num: int, max_rounds: int) -> Layout:
        """Create terminal layout."""
        layout = Layout()
        
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="main"),
            Layout(name="findings", size=10),
        )
        
        layout["header"].update(Panel(
            f"[bold]🔬 Hilbert Research[/bold]  [Round {round_num}/{max_rounds}]",
            style="blue"
        ))
        
        layout["main"].update(Panel(
            f"[bold]Query:[/bold] {query}",
            style="cyan"
        ))
        
        return layout

    def create_progress_table(self, agents_status: dict) -> Table:
        """Create search agents progress table."""
        table = Table(title="Search Agents", box=None)
        table.add_column("Agent", style="cyan")
        table.add_column("Status", style="green")
        
        for i, (agent, status) in enumerate(agents_status.items(), 1):
            icon = "✓" if status == "done" else "⏳" if status == "running" else "○"
            table.add_row(f"Agent {i}: {agent}", f"{icon} {status}")
        
        return table

    def create_findings_panel(self, findings: list[dict]) -> Panel:
        """Create findings panel."""
        if not findings:
            return Panel("No findings yet", title="Recent Findings")
        
        lines = []
        for f in findings[-5:]:
            claim = f.get("claim", "")[:60]
            conf = f.get("confidence", 0.0)
            label = "high" if conf >= 0.9 else "med" if conf >= 0.75 else "low"
            lines.append(f"• {claim}... [{label}: {conf:.2f}]")
        
        return Panel("\n".join(lines), title="Recent Findings")

    def create_stats_panel(self, papers_count: int, findings_count: int, status: str) -> Panel:
        """Create stats panel."""
        stats = [
            f"Papers: {papers_count}",
            f"Findings: {findings_count}",
            f"Status: {status}",
        ]
        return Panel("\n".join(stats), title="Progress")

    def create_live_panel(self, round_num: int, max_rounds: int, node: str) -> Panel:
        """Create live progress panel with detailed status."""
        progress = f"Round {round_num}/{max_rounds}"
        
        lines = [f"🔬 {progress}", f"Current: {node}"]
        
        if self.search_agents:
            lines.append("")
            lines.append("Search Agents:")
            for agent, status in self.search_agents.items():
                icon = "✓" if status == "done" else "⏳" if status == "running" else "○"
                lines.append(f"  {icon} {agent}: {status}")
        
        lines.append("")
        lines.append(f"Papers fetched: {self.papers_fetched}")
        lines.append(f"Findings: {self.findings_count}")
        
        if self.round_data:
            lines.append("")
            lines.append("Rounds:")
            for rd in self.round_data:
                lines.append(f"  Round {rd['round']}: {rd['papers']} papers, {rd['findings']} findings")
        
        return Panel("\n".join(lines), title="Live Progress")

    def create_detailed_findings_panel(self, findings: list) -> Panel:
        """Create detailed findings panel with confidence levels."""
        if not findings:
            return Panel("No findings yet", title="Findings")
        
        lines = []
        for i, f in enumerate(findings[-8:]):
            claim = f.get("claim", "")[:50]
            conf = f.get("confidence", 0.0)
            verified = "✓" if f.get("is_verified", False) else "○"
            
            if conf >= 0.9:
                color = "green"
            elif conf >= 0.75:
                color = "yellow"
            else:
                color = "red"
            
            lines.append(f"{verified} [{color}]{conf:.2f}[/{color}] {claim}...")
        
        return Panel("\n".join(lines), title="Findings")


def get_hilbert_console() -> Console:
    """Get Hilbert console singleton."""
    return console


def print_info(message: str) -> None:
    """Print info message."""
    console.print(f"[blue]ℹ[/blue] {message}")


def print_success(message: str) -> None:
    """Print success message."""
    console.print(f"[green]✓[/green] {message}")


def print_warning(message: str) -> None:
    """Print warning message."""
    console.print(f"[yellow]⚠[/yellow] {message}")


def print_error(message: str) -> None:
    """Print error message."""
    console.print(f"[red]✗[/red] {message}")


def print_header(message: str) -> None:
    """Print header."""
    console.print(f"\n[bold cyan]{message}[/bold cyan]")


def print_step(step: str) -> None:
    """Print current step."""
    console.print(f"[bold yellow]⟫[/bold yellow] {step}")
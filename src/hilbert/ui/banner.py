"""Banner and logo display for Hilbert."""

from pathlib import Path
from typing import Optional

import rich
from rich import box
from rich.align import Align
from rich.console import Console
from rich.panel import Panel
from rich.text import Text


def load_ascii_logo() -> str:
    """Load Hilbert ASCII logo from ascii.txt."""
    import os
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    ascii_path = base_dir / "ascii.txt"
    if ascii_path.exists():
        return ascii_path.read_text().strip()
    return ""


def render_logo() -> str:
    """Get rendered logo."""
    logo = load_ascii_logo()
    if not logo:
        return "Hilbert"
    return logo


def create_welcome_banner(version: str = "0.1.0") -> Panel:
    """Create welcome banner with logo."""
    logo = render_logo()
    
    welcome_text = Text()
    welcome_text.append(logo + "\n\n", style="bold green")
    welcome_text.append(f"  v{version}          ", style="dim")
    welcome_text.append("Research Agent", style="bold cyan")
    
    return Panel(
        welcome_text,
        box=box.DOUBLE,
        style="cyan",
        padding=(1, 2),
        title="[bold green]HILBERT[/bold green]",
        title_align="left",
    )


def create_status_banner(
    python_version: str,
    deps_status: dict,
    status: str = "Ready",
) -> Panel:
    """Create status dashboard banner."""
    from rich.table import Table
    
    table = Table(show_header=False, box=None, pad_edge=0)
    table.add_column("key", style="cyan", width=15)
    table.add_column("value", style="white")
    
    table.add_row("Python", python_version)
    table.add_row("Status", f"[green]{status}[/green]")
    
    deps_ok = sum(1 for v in deps_status.values() if v)
    deps_total = len(deps_status)
    table.add_row("Deps", f"[green]{deps_ok}[/green]/{deps_total}")
    
    return Panel(
        table,
        box=box.ROUNDED,
        style="blue",
        padding=(1, 2),
        title="[bold cyan]Status[/bold cyan]",
    )


def create_header(
    title: str,
    subtitle: Optional[str] = None,
    style: str = "cyan",
) -> Panel:
    """Create a styled header panel."""
    content = Text()
    content.append(title, style=f"bold {style}")
    if subtitle:
        content.append(f"\n{subtitle}", style="dim")
    
    return Panel(
        content,
        box=box.DOUBLE,
        style=style,
        padding=(0, 1),
    )


def print_banner() -> None:
    """Print welcome banner to console."""
    console = Console()
    banner = create_welcome_banner()
    console.print(banner)
    console.print()


def print_header(title: str) -> None:
    """Print styled header."""
    console = Console()
    header = create_header(title)
    console.print(header)
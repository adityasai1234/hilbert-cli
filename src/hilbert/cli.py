"""CLI for Hilbert research agent."""

from typing import Optional
import typer
from rich.console import Console

from hilbert.config.settings import HilbertSettings, get_settings
from hilbert import __version__
from hilbert.persistence import SessionManager

app = typer.Typer(
    name="hilbert",
    help="Hilbert - CLI research agent for academic researchers",
    add_completion=False,
)
console = Console()


@app.command()
def research(
    query: str = typer.Argument(..., help="Research query"),
    rounds: int = typer.Option(3, "--rounds", "-r", help="Number of research rounds"),
    sub_questions: int = typer.Option(4, "--sub-questions", "-n", help="Parallel sub-questions"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="LLM model"),
) -> None:
    """Run a research query."""
    console.print(f"[bold cyan]🔬 Hilbert Research[/bold cyan]")
    console.print(f"Query: {query}")
    console.print(f"Rounds: {rounds}, Sub-questions: {sub_questions}")

    try:
        import asyncio
        from hilbert.graph import run_research
        from hilbert.ui import print_info, print_success, print_error
        from hilbert.config.settings import get_settings

        settings = get_settings()
        settings.ensure_dirs()

        print_info("Starting research workflow...")

        result = asyncio.run(run_research(query, max_rounds=rounds))

        report = result.get("report")
        if report:
            print_success(f"Report saved to {settings.output_dir}")
            console.print(f"\n[green]✓ Research complete![/green]")
            console.print(f"Found {len(result.get('findings', []))} findings")
            console.print(f"Found {len(result.get('papers', []))} papers")
        else:
            print_error("Research failed")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        console.print(f"[yellow]Note: Set HILBERT_API_KEY for LLM calls[/yellow]")


@app.command()
def sessions(
    action: str = typer.Argument("list", help="list, show, clear, or export"),
    session_id: Optional[str] = typer.Argument(None, help="Session ID"),
) -> None:
    """Manage research sessions."""
    manager = SessionManager()
    
    if action == "list":
        sessions_list = manager.list_sessions()
        if not sessions_list:
            console.print("[yellow]No sessions yet[/yellow]")
            return
        
        from rich.table import Table
        table = Table(title="Sessions")
        table.add_column("ID")
        table.add_column("Query")
        table.add_column("Status")
        table.add_column("Round")
        
        for s in sessions_list:
            table.add_row(s.session_id, s.query[:40], s.status.value, str(s.current_round))
        
        console.print(table)
    
    elif action == "show":
        if not session_id:
            console.print("[red]Session ID required[/red]")
            raise typer.Exit(1)
        
        session = manager.get_session(session_id)
        if not session:
            console.print(f"[red]Session not found: {session_id}[/red]")
            raise typer.Exit(1)
        
        console.print(f"[bold]Session: {session.session_id}[/bold]")
        console.print(f"Query: {session.query}")
        console.print(f"Status: {session.status.value}")
        console.print(f"Round: {session.current_round}/{session.max_rounds}")
    
    elif action == "clear":
        if not session_id:
            console.print("[red]Session ID required[/red]")
            raise typer.Exit(1)
        
        manager.delete_session(session_id)
        console.print(f"[green]Session cleared: {session_id}[/green]")
    
    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(1)


@app.command()
def config(
    action: str = typer.Argument("show", help="show, set, or init"),
    key: Optional[str] = typer.Argument(None, help="Config key"),
    value: Optional[str] = typer.Argument(None, help="Config value"),
) -> None:
    """Manage configuration."""
    settings = get_settings()
    
    if action == "show":
        console.print("[bold]Configuration[/bold]")
        console.print(f"model: {settings.model}")
        console.print(f"max_rounds: {settings.max_rounds}")
        console.print(f"sub_questions: {settings.sub_questions}")
        console.print(f"top_k: {settings.top_k}")
        console.print(f"output_dir: {settings.output_dir}")
    
    elif action == "set":
        if not key or not value:
            console.print("[red]Key and value required[/red]")
            raise typer.Exit(1)
        
        console.print(f"[yellow]Config set not implemented - use environment variables[/yellow]")
        console.print(f"HILBERT_{key.upper()}={value}")
    
    elif action == "init":
        settings.ensure_dirs()
        console.print(f"[green]Initialized: {settings.output_dir}[/green]")
        console.print(f"[green]Initialized: {settings.log_dir}[/green]")
    
    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(1)


@app.command()
def watch() -> None:
    """Watch running research progress."""
    console.print("[yellow]Watch mode not implemented yet[/yellow]")


@app.command()
def doctor() -> None:
    """Check Hilbert installation."""
    console.print("[bold]Hilbert Doctor[/bold]\n")
    
    # Check Python version
    import sys
    console.print(f"Python: {sys.version.split()[0]}")
    
    # Check installed packages
    console.print("Dependencies:")
    deps = ["langgraph", "litellm", "rich", "typer", "pydantic", "sqlalchemy"]
    for dep in deps:
        try:
            __import__(dep)
            console.print(f"  ✓ {dep}")
        except ImportError:
            console.print(f"  ✗ {dep} [red]missing[/red]")
    
    console.print(f"\nHilbert version: {__version__}")


@app.command()
def version() -> None:
    """Show Hilbert version."""
    console.print(f"Hilbert {__version__}")


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context) -> None:
    """Hilbert - CLI research agent."""
    if ctx.invoked_subcommand is None:
        console.print(f"Hilbert {__version__}")
        console.print("Run 'hilbert --help' for usage information")
        raise typer.Exit(0)


if __name__ == "__main__":
    app()
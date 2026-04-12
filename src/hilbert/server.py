"""Server mode for Hilbert - enables IPC communication with TypeScript CLI."""

import asyncio
import json
import sys
from typing import Any, Dict
import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from hilbert import __version__

server_app = typer.Typer(name="server", help="Hilbert server mode for IPC")
console = Console()


class IPCServer:
    """Simple stdin/stdout IPC server for communication with TypeScript CLI."""

    def __init__(self):
        self.running = False

    async def handle_command(self, command: str, args: list[str], options: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming IPC commands."""
        from hilbert.graph import run_research
        from hilbert.config.settings import get_settings
        from hilbert.persistence import SessionManager

        settings = get_settings()
        settings.ensure_dirs()
        manager = SessionManager()

        if command == "deepresearch":
            topic = args[0] if args else options.get("topic", "")
            rounds = options.get("rounds", 3)

            console.print(f"[cyan]Running research: {topic}[/cyan]")

            result = await run_research(topic, max_rounds=rounds)

            report = result.get("report")
            if report:
                return {
                    "report_id": result.get("session_id", "unknown"),
                    "files": [
                        f"{settings.output_dir}/report.md",
                        f"{settings.output_dir}/report.json",
                        f"{settings.output_dir}/report.bib",
                    ],
                }
            return {"error": "Research failed"}

        elif command == "sessions":
            action = args[0] if args else "list"

            if action == "list":
                sessions = manager.list_sessions()
                return [
                    {
                        "id": s.session_id,
                        "query": s.query,
                        "status": s.status.value,
                        "created_at": s.created_at.isoformat(),
                    }
                    for s in sessions
                ]

            elif action == "show":
                session_id = args[1] if len(args) > 1 else None
                if session_id:
                    session = manager.get_session(session_id)
                    if session:
                        return {
                            "query": session.query,
                            "status": session.status.value,
                            "rounds": session.current_round,
                            "papers": 0,
                            "findings": 0,
                        }
                return {"error": "Session not found"}

            elif action == "clear":
                session_id = args[1] if len(args) > 1 else None
                if session_id:
                    manager.delete_session(session_id)
                    return {"success": True}
                return {"error": "Session ID required"}

        elif command == "lit":
            topic = args[0] if args else options.get("topic", "")
            console.print(f"[cyan]Running literature review: {topic}[/cyan]")
            rounds = options.get("rounds", 3)
            result = await run_research(topic, max_rounds=rounds)
            report = result.get("report")
            if report:
                return {
                    "report_id": result.get("session_id", "unknown"),
                    "files": [
                        f"{settings.output_dir}/lit-review.md",
                        f"{settings.output_dir}/sources.json",
                    ],
                }
            return {"error": "Literature review failed"}

        elif command == "compare":
            topic = args[0] if args else options.get("topic", "")
            console.print(f"[cyan]Running comparison: {topic}[/cyan]")
            rounds = options.get("rounds", 3)
            result = await run_research(topic, max_rounds=rounds)
            report = result.get("report")
            if report:
                return {
                    "report_id": result.get("session_id", "unknown"),
                    "files": [
                        f"{settings.output_dir}/comparison.md",
                        f"{settings.output_dir}/matrix.json",
                    ],
                }
            return {"error": "Comparison failed"}

        elif command == "review":
            artifact = args[0] if args else options.get("artifact", "")
            console.print(f"[cyan]Running peer review: {artifact}[/cyan]")
            return {
                "files": [
                    f"{settings.output_dir}/review.md",
                    f"{settings.output_dir}/annotations.md",
                ],
            }

        elif command == "draft":
            topic = args[0] if args else options.get("topic", "")
            console.print(f"[cyan]Generating draft: {topic}[/cyan]")
            return {
                "files": [
                    f"{settings.output_dir}/draft.md",
                ],
            }

        elif command == "log":
            session_id = args[0] if args else None
            sessions = manager.list_sessions()
            logs = []
            for s in sessions:
                logs.append({
                    "timestamp": s.created_at.isoformat(),
                    "action": s.status.value,
                    "details": s.query[:50]
                })
            return logs

        return {"error": f"Unknown command: {command}"}

    async def send_response(self, msg_id: str, result: Any, msg_type: str = "response"):
        """Send a response message."""
        response = {
            "type": msg_type,
            "id": msg_id,
            "result" if msg_type == "response" else "data": result,
        }
        print(json.dumps(response), flush=True)

    async def send_stream(self, msg_id: str, event: str, data: Any):
        """Send a stream message."""
        response = {
            "type": "stream",
            "id": msg_id,
            "event": event,
            "data": data,
        }
        print(json.dumps(response), flush=True)

    async def run(self):
        """Run the IPC server."""
        self.running = True

        console.print(Panel(
            Text(f"Hilbert Server v{__version__}", style="bold cyan"),
            box=None,
            padding=(0, 1),
        ))

        while self.running:
            try:
                line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
                if not line:
                    break

                msg = json.loads(line.strip())

                if msg.get("type") == "command":
                    msg_id = msg.get("id", "")
                    command = msg.get("command", "")
                    args = msg.get("args", [])
                    options = msg.get("options", {})

                    try:
                        result = await self.handle_command(command, args, options)
                        await self.send_response(msg_id, result)
                    except Exception as e:
                        await self.send_response(msg_id, {"error": str(e)}, "error")

            except json.JSONDecodeError:
                continue
            except Exception as e:
                console.print(f"[red]Error: {e}[/red]")
                break

        console.print("[yellow]Server stopped[/yellow]")


@server_app.command()
def start(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(8765, "--port", "-p", help="Port to listen on"),
):
    """Start the Hilbert IPC server."""
    console.print(f"[cyan]Starting Hilbert server on {host}:{port}...[/cyan]")
    console.print("[yellow]Note: Use 'hilbert server stdio' for CLI communication[/yellow]")

    server = IPCServer()
    asyncio.run(server.run())


@server_app.command()
def stdio():
    """Start server in stdio mode for CLI communication."""
    server = IPCServer()
    asyncio.run(server.run())


if __name__ == "__main__":
    server_app()
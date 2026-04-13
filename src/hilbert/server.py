"""Server mode for Hilbert - enables IPC communication with TypeScript CLI."""

import asyncio
import json
import sys
from typing import Any, Dict
import typer

from hilbert import __version__

server_app = typer.Typer(name="server", help="Hilbert server mode for IPC")


def log(msg: str):
    """Log to stderr to avoid interfering with JSON protocol."""
    print(msg, file=sys.stderr, flush=True)


class IPCServer:
    """Simple stdin/stdout IPC server for communication with TypeScript CLI."""

    def __init__(self):
        self.running = False

    async def handle_command(self, command: str, args: list[str], options: Dict[str, Any], msg_id: str = "") -> Dict[str, Any]:
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

            log(f"Running research: {topic}")

            # Build a progress callback that streams node transitions to the CLI
            # msg_id is captured from the outer scope
            _msg_id = msg_id  # local alias for lambda capture

            def _progress(node: str, data: Dict[str, Any]) -> None:
                asyncio.get_event_loop().call_soon_threadsafe(
                    asyncio.ensure_future,
                    self.send_stream(_msg_id, "progress", {"current_node": node, **data}),
                )

            result = await run_research(topic, max_rounds=rounds, progress_callback=_progress)

            report = result.get("report")
            if report:
                return {
                    "report_id": result.get("session_id", "unknown"),
                    "files": [
                        f"{settings.output_dir}/report.md",
                        f"{settings.output_dir}/report.json",
                        f"{settings.output_dir}/report.bib",
                        f"{settings.output_dir}/report.tex",
                        f"{settings.output_dir}/report.mmd",
                        f"{settings.output_dir}/report.provenance.md",
                    ],
                }
            return {"error": "Research failed"}

        elif command == "sessions":
            action = args[0] if args else "list"

            if action == "list":
                tag_filter = options.get("tag")
                status_filter = options.get("status")
                since_filter = options.get("since")

                from datetime import datetime, timedelta

                since_dt = None
                if since_filter:
                    try:
                        since_dt = datetime.fromisoformat(since_filter.replace('Z', '+00:00'))
                    except ValueError:
                        pass

                sessions = manager.list_sessions(
                    tags=[tag_filter] if tag_filter else None,
                    status=status_filter,
                    since=since_dt,
                )
                return [
                    {
                        "id": s.session_id,
                        "query": s.query,
                        "status": s.status.value,
                        "created_at": s.created_at.isoformat(),
                        "tags": s.tags,
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
            log(f"Running literature review: {topic}")
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
            log(f"Running comparison: {topic}")
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
            log(f"Running peer review: {artifact}")
            return {
                "files": [
                    f"{settings.output_dir}/review.md",
                    f"{settings.output_dir}/annotations.md",
                ],
            }

        elif command == "draft":
            topic = args[0] if args else options.get("topic", "")
            log(f"Generating draft: {topic}")
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

        elif command == "continue":
            session_id = args[0] if args else options.get("session_id", "")
            if not session_id:
                return {"error": "Session ID required"}

            log(f"Continuing session: {session_id}")

            session = manager.get_session(session_id)
            if not session:
                return {"error": "Session not found"}

            _msg_id = msg_id

            def _progress(node: str, data: Dict[str, Any]) -> None:
                asyncio.get_event_loop().call_soon_threadsafe(
                    asyncio.ensure_future,
                    self.send_stream(_msg_id, "progress", {"current_node": node, **data}),
                )

            result = await run_research(
                session.query,
                max_rounds=session.max_rounds,
                progress_callback=_progress,
                incremental=True,
                session_id=session_id,
            )

            report = result.get("report")
            if report:
                return {
                    "report_id": result.get("session_id", session_id),
                    "files": [
                        f"{settings.output_dir}/report.md",
                        f"{settings.output_dir}/report.json",
                        f"{settings.output_dir}/report.bib",
                        f"{settings.output_dir}/report.tex",
                        f"{settings.output_dir}/report.mmd",
                        f"{settings.output_dir}/report.provenance.md",
                    ],
                    "incremental": True,
                }
            return {"error": "Research failed"}

        elif command == "replicate":
            paper = args[0] if args else options.get("paper", "")
            log(f"Planning replication: {paper}")
            return {
                "files": [
                    f"{settings.output_dir}/replicate-plan.md",
                ],
            }

        elif command == "audit":
            item = args[0] if args else options.get("item", "")
            log(f"Running audit: {item}")
            return {
                "files": [
                    f"{settings.output_dir}/audit.md",
                ],
            }

        elif command == "diff":
            session_a = args[0] if args else options.get("session_a", "")
            session_b = args[1] if args else options.get("session_b", "")

            if not session_a or not session_b:
                return {"error": "Two session IDs required: hilbert diff <session-a> <session-b>"}

            log(f"Comparing sessions: {session_a} vs {session_b}")

            from hilbert.sources.embeddings import cosine_similarity, get_embedding_client
            from hilbert.persistence.manager import get_session_manager

            manager = get_session_manager()

            papers_a = manager.get_papers(session_a)
            papers_b = manager.get_papers(session_b)
            findings_a = manager.get_findings(session_a)
            findings_b = manager.get_findings(session_b)

            paper_ids_a = {p.paper_id for p in papers_a}
            paper_ids_b = {p.paper_id for p in papers_b}

            only_a = paper_ids_a - paper_ids_b
            only_b = paper_ids_b - paper_ids_a
            shared = paper_ids_a & paper_ids_b

            findings_similarity = 0.0
            if findings_a and findings_b:
                texts_a = [f.claim for f in findings_a]
                texts_b = [f.claim for f in findings_b]
                embeddings_a = await get_embedding_client().embed_texts(texts_a)
                embeddings_b = await get_embedding_client().embed_texts(texts_b)

                total_sim = 0.0
                count = 0
                for emb_a in embeddings_a:
                    best = 0.0
                    for emb_b in embeddings_b:
                        sim = cosine_similarity(emb_a, emb_b)
                        if sim > best:
                            best = sim
                    total_sim += best
                    count += 1
                findings_similarity = total_sim / count if count > 0 else 0.0

            return {
                "session_a": session_a,
                "session_b": session_b,
                "papers_only_a": len(only_a),
                "papers_only_b": len(only_b),
                "papers_shared": len(shared),
                "findings_a": len(findings_a),
                "findings_b": len(findings_b),
                "findings_similarity": round(findings_similarity, 3),
            }

        elif command == "tag":
            session_id = args[0] if args else options.get("session_id", "")
            tag = args[1] if len(args) > 1 else options.get("tag", "")

            if not session_id or not tag:
                return {"error": "Usage: tag <session-id> <tag>"}

            manager.add_tag(session_id, tag)
            return {"success": True, "tag": tag, "session_id": session_id}

        return {"error": f"Unknown command: {command}"}

    async def send_response(self, msg_id: str, result: Any, msg_type: str = "response"):
        """Send a response message to stdout."""
        response = {
            "type": msg_type,
            "id": msg_id,
            "result" if msg_type == "response" else "data": result,
        }
        print(json.dumps(response), flush=True)

    async def send_stream(self, msg_id: str, event: str, data: Any):
        """Send a stream message to stdout."""
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

        log(f"Hilbert Server v{__version__} - stdin/stdout mode")

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
                        result = await self.handle_command(command, args, options, msg_id=msg_id)
                        await self.send_response(msg_id, result)
                    except Exception as e:
                        await self.send_response(msg_id, {"error": str(e)}, "error")

            except json.JSONDecodeError:
                continue
            except Exception as e:
                log(f"Error: {e}")
                break

        log("Server stopped")


@server_app.command()
def start(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(8765, "--port", "-p", help="Port to listen on"),
):
    """Start the Hilbert IPC server."""
    log(f"Starting Hilbert server on {host}:{port}...")
    log("Note: Use 'hilbert server stdio' for CLI communication")

    server = IPCServer()
    asyncio.run(server.run())


@server_app.command()
def stdio():
    """Start server in stdio mode for CLI communication."""
    server = IPCServer()
    asyncio.run(server.run())


if __name__ == "__main__":
    server_app()
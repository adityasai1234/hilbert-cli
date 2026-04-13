# Hilbert

CLI research agent for academic researchers — ground-up replacement for Feynman.

## Features

- **Guaranteed termination** — Fixed N rounds (default 3) + mandatory synthesis gate
- **SQLite resume** — Crash recovery from checkpoint
- **Open APIs** — ArXiv + Semantic Scholar (no proprietary layers)
- **Rich terminal** — Live progress panels
- **BibTeX export** — Auto-generated bibliography
- **Semantic citations** — Embedding-based verification (≥0.75 threshold)
- **Flexible models** — LiteLLM supports any configured provider
- **Incremental research** — Continue sessions to fetch only new papers
- **Session tagging** — Tag and filter sessions
- **LaTeX export** — Generate `report.tex`
- **Knowledge graph** — Mermaid visualization of citations

## Installation

### Python Backend
```bash
pip install -e .
```

Or from PyPI (coming soon):
```bash
pip install hilbert
```

### TypeScript CLI (Recommended)
```bash
cd cli
npm install
npm run install:global
```

This installs the `hilbert` command globally, enabling:
```bash
hilbert "What are the key challenges in federated learning?"
```

## Quick Start

```bash
# Run a research query (one-shot mode)
hilbert "What are the key challenges in federated learning?"

# Interactive REPL mode
hilbert

# Check installation
hilbert doctor

# Configure
export HILBERT_API_KEY=sk-...
export OPENAI_API_KEY=sk-...
```

## CLI Commands

```bash
hilbert "query"                  # Run research (one-shot)
hilbert                          # Start REPL
hilbert research "query"         # Run research workflow
hilbert continue <session-id>    # Continue previous session
hilbert diff <session-a> <session-b>  # Compare sessions
hilbert sessions                 # List sessions
hilbert sessions --tag important # Filter by tag
hilbert sessions --status done   # Filter by status
hilbert sessions --since 2024-01-01  # Filter by date
hilbert sessions show ID        # Show session details
hilbert sessions clear ID       # Clear session
hilbert config show             # Show configuration
hilbert config init             # Initialize directories
hilbert doctor                  # Check installation
hilbert version                 # Show version
```

## REPL Slash Commands

```
/deepresearch <topic>    Run deep research
/continue <session-id>  Continue previous session
/tag <id> <tag>          Tag a session
/lit <topic>            Write literature review
/compare <topic>        Compare approaches
/review <artifact>      Review a paper
/draft <topic>          Draft research paper
/log [session-id]       View session history
/theme [name]           Set theme
/help                   Show commands
/quit                   Exit
```

## Configuration

Set via environment variables:

```bash
HILBERT_MODEL=gpt-4o
HILBERT_API_KEY=sk-...
HILBERT_MAX_ROUNDS=3
HILBERT_SUB_QUESTIONS=4
HILBERT_TOP_K=20
HILBERT_CONFIDENCE_THRESHOLD=0.75
```

## Output

Generates six files in `outputs/`:
- `report.md` — Markdown report
- `report.json` — Structured JSON
- `report.bib` — BibTeX bibliography
- `report.tex` — LaTeX article
- `report.mmd` — Mermaid knowledge graph
- `report.provenance.md` — Provenance metadata

## Requirements

- Python 3.9+
- Node.js 18+

### Python Dependencies
- langgraph ~0.2
- litellm ~1.0
- rich ~13.0
- typer ~0.12
- pydantic ~2.0

## Why Hilbert over Feynman?

| Problem | Feynman | Hilbert |
|---------|---------|---------|
| Infinite loops | Yes | Fixed rounds |
| Resume | No | SQLite checkpoint |
| Open APIs | AlphaXiv (proprietary) | ArXiv + Semantic Scholar |
| BibTeX | No | Auto-export |
| Live UI | No | Rich panels |

## License

MIT
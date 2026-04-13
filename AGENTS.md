# Hilbert Development Guide

## Project Overview

Hilbert is a Python CLI research agent with TypeScript frontend and Python backend (LangGraph + LiteLLM).

## Build, Lint, and Test Commands

### Python Backend

```bash
# Install dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run single test (file::class::method)
pytest tests/test_state.py::TestResearchState::test_create_initial_state

# Run tests with coverage
pytest --cov=src/hilbert --cov-report=term-missing

# Lint with ruff
ruff check src/hilbert/

# Type check with mypy
mypy src/hilbert/

# Format with ruff (autofix)
ruff format src/hilbert/

# All checks (ci equivalent)
ruff check src/hilbert/ && mypy src/hilbert/ && pytest
```

### TypeScript CLI

```bash
# Install dependencies
cd cli && npm install

# Build TypeScript
npm run build  # or: tsc

# Run single test
npx vitest run tests/test_name.test.ts

# Run all tests
npm test  # or: vitest

# Run in watch mode
npx vitest

# Dev mode (hot reload)
npm run dev
```

## Code Style Guidelines

### Python

**Imports:**
- Use absolute imports: `from hilbert.llm import get_client`
- Group: stdlib → third-party → local
- Sort within groups alphabetically

**Types:**
- Use `TypedDict` for state objects (see `src/hilbert/state/research.py`)
- Use Pydantic models for data validation (`src/hilbert/models/`)
- Enable strict typing: `disallow_untyped_defs = true` in mypy config
- Prefer explicit return types on async functions

**Naming:**
- `snake_case` for functions/variables
- `PascalCase` for classes/types
- `SCREAMING_SNAKE_CASE` for constants
- Prefix private methods with underscore: `_private_method()`

**Error Handling:**
- Use specific exception types, not bare `except:`
- Prefer fail-fast with typed errors
- Log at appropriate level (debug/info/warning/error)
- Example:
  ```python
  try:
      client = get_client()
      content = await client.complete_text(...)
  except Exception:
      pass  # Keep fallbacks on graceful degradation
  ```

**Async:**
- Use `async def` for I/O-bound operations
- Always `await` async functions
- Use `asyncio.create_task()` for fire-and-forget

**Formatting:**
- Line length: 100 characters (configured in ruff)
- 4-space indentation
- Double quotes for strings

### TypeScript

**Imports:**
- Use ES module syntax: `import { Command } from 'commander'`
- Group: external → internal
- Relative imports for local modules

**Types:**
- Enable strict mode in tsconfig.json
- Use explicit return types on exported functions
- Avoid `any` - use `unknown` when type is uncertain
- Example: `async function runResearch(topic: string, options: Options): Promise<void>`

**Naming:**
- `camelCase` for variables/functions
- `PascalCase` for classes/components
- `kebab-case` for file names

**Error Handling:**
- Use typed error classes (see `cli/src/errors.ts`)
- Propagate errors with context: `throw new Error(\`Failed: \${reason}\`)`
- Handle async errors with try/catch

**Formatting:**
- Use existing tsconfig settings (ES2020, CommonJS)
- 2-space indentation
- Single quotes for strings

## Architecture Patterns

### LangGraph Nodes

Each node in `src/hilbert/nodes/` follows this pattern:
```python
async def node_name(state: ResearchState) -> dict:
    # Extract inputs from state
    query = state["query"]
    
    # Do work, optionally with progress callback
    callback = state.get("progress_callback")
    if callback:
        callback("node_name", {"status": "..."})
    
    # Return state updates (dict, not state mutation)
    return {"key": "value", "status": "..."}

def create_node_name():
    return node_name
```

### State Management

- Use `ResearchState` TypedDict for all graph state
- Initialize with `create_initial_state(query, max_rounds)`
- All state updates are dict returns from nodes

### IPC Protocol

CLI communicates with Python backend via JSON over stdin/stdout:
- Request: `{ "action": "...", "params": {...} }`
- Response: `{ "status": "ok|error", "data": {...} }`

## File Organization

```
src/hilbert/           # Python package
├── nodes/             # LangGraph nodes (planner, search, merger, etc.)
├── sources/           # Data sources (arxiv, semantic scholar)
├── models/            # Pydantic models (paper, finding, report)
├── persistence/       # SQLite manager and schema
├── llm/               # LLM client and prompts
├── ui/                # Terminal UI (themes, tables, charts)
├── state/             # State definitions
└── config/            # Settings and logging

cli/src/               # TypeScript CLI
├── commands/          # CLI commands (research, sessions, etc.)
├── ipc/               # Backend IPC client
├── ui/                # CLI-specific UI
└── repl.ts            # Interactive REPL
```

## Testing Guidelines

- Place tests in `tests/` directory (Python) or alongside source (TypeScript)
- Test file naming: `test_*.py` or `*.test.ts`
- Use fixtures for reusable test data
- Mock external services (LLM, HTTP calls)
- Test state transitions in LangGraph nodes
- Minimum: cover critical paths and error handling
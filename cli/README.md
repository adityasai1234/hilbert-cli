# Hilbert CLI

A Python CLI research agent that replaces Feynman with a better architecture.

## Quick Start

```bash
# One-shot research
hilbert "quantum computing advances"

# Interactive REPL
hilbert

# Help
hilbert --help
```

## Installation

```bash
# From source
cd cli
npm install
npm run build
npm link

# Or use the binary directly
node dist/index.js
```

## Commands

| Command | Description |
|---------|-------------|
| `hilbert "query"` | One-shot research |
| `hilbert interactive` | Start REPL |
| `hilbert research <topic>` | Explicit research |
| `hilbert sessions` | List sessions |
| `hilbert setup` | First-run setup |
| `hilbert doctor` | Check installation |
| `hilbert config --show` | Show config |
| `hilbert replicate <paper>` | Replicate paper |
| `hilbert audit <item>` | Audit claims |
| `hilbert jobs` | List jobs |

## Options

```bash
-r, --rounds <n>         Number of research rounds (default: 3)
-m, --model <model>      LLM model to use
-o, --output <dir>       Output directory
-s, --sub-questions <n>  Parallel sub-questions (default: 4)
-k, --top-k <n>         Papers to retain (default: 20)
```

## Environment Variables

```bash
OPENAI_API_KEY=sk-...      # For OpenAI models
ANTHROPIC_API_KEY=sk-...  # For Anthropic models
```

## Shell Completion

```bash
# Bash
source cli/completions/hilbert.bash

# Zsh
source cli/completions/hilbert.zsh
```
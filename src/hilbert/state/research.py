"""ResearchState for LangGraph."""

from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, TypedDict

from hilbert.models.paper import Paper
from hilbert.models.finding import Finding
from hilbert.models.report import Report


class ResearchDimension(TypedDict):
    """A single research angle with a distinct search strategy."""

    label: str          # e.g. "recent advances"
    focus: str          # natural-language focus description
    strategy: str       # "recent" | "foundational" | "applied" | "survey"
    time_range: str     # e.g. "2023-2025" or "all"


class ResearchState(TypedDict):
    """State passed between LangGraph nodes."""

    query: str
    round: int
    max_rounds: int
    sub_questions: List[str]
    research_dimensions: List[ResearchDimension]
    papers: List[Paper]
    papers_consulted: int       # raw count before dedup/top-k filter
    findings: List[Finding]
    report: Optional[Report]
    status: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    progress_callback: Optional[Callable[[str, Dict[str, Any]], None]]


def create_initial_state(
    query: str,
    max_rounds: int = 3,
    progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> ResearchState:
    """Create initial research state."""
    return {
        "query": query,
        "round": 0,
        "max_rounds": max_rounds,
        "sub_questions": [],
        "research_dimensions": [],
        "papers": [],
        "papers_consulted": 0,
        "findings": [],
        "report": None,
        "status": "planning",
        "error_message": None,
        "started_at": datetime.now(),
        "progress_callback": progress_callback,
    }
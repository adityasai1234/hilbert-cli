"""ResearchState for LangGraph."""

from typing import List, Optional, TypedDict

from hilbert.models.paper import Paper
from hilbert.models.finding import Finding
from hilbert.models.report import Report


class ResearchState(TypedDict):
    """State passed between LangGraph nodes."""

    query: str
    round: int
    max_rounds: int
    sub_questions: List[str]
    papers: List[Paper]
    findings: List[Finding]
    report: Optional[Report]
    status: str
    error_message: Optional[str]


def create_initial_state(query: str, max_rounds: int = 3) -> ResearchState:
    """Create initial research state."""
    return {
        "query": query,
        "round": 0,
        "max_rounds": max_rounds,
        "sub_questions": [],
        "papers": [],
        "findings": [],
        "report": None,
        "status": "planning",
        "error_message": None,
    }
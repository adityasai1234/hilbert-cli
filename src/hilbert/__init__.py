"""Hilbert - CLI research agent for academic researchers."""

__version__ = "0.1.0"

from hilbert.models.paper import Paper
from hilbert.models.finding import Finding
from hilbert.models.report import Report
from hilbert.state.research import ResearchState, create_initial_state

__all__ = [
    "__version__",
    "Paper",
    "Finding",
    "Report",
    "ResearchState",
    "create_initial_state",
]
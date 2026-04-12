"""Rich terminal UI for Hilbert."""

from hilbert.ui.panels import (
    HilbertPanels,
    get_hilbert_console,
    print_info,
    print_success,
    print_warning,
    print_error,
    print_header,
    print_step,
)
from hilbert.ui.progress import create_progress, create_simple_progress
from hilbert.ui.charts import (
    render_bar_chart,
    render_progress_bar,
    render_rounds_chart,
    render_table,
    render_stats_summary,
)
from hilbert.ui.mermaid import (
    generate_research_mermaid,
    render_research_flow,
    render_findings_mermaid,
    render_sources_mermaid,
)

__all__ = [
    "HilbertPanels",
    "get_hilbert_console",
    "print_info",
    "print_success",
    "print_warning",
    "print_error",
    "print_header",
    "print_step",
    "create_progress",
    "create_simple_progress",
    "render_bar_chart",
    "render_progress_bar",
    "render_rounds_chart",
    "render_table",
    "render_stats_summary",
    "generate_research_mermaid",
    "render_research_flow",
    "render_findings_mermaid",
    "render_sources_mermaid",
]
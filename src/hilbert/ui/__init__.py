"""Rich terminal UI for Hilbert."""

from hilbert.ui.theme import COLORS, terminal_width
from hilbert.ui.banner import (
    create_welcome_banner,
    create_status_banner,
    create_header,
    print_banner,
    print_header as print_banner_header,
)
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
from hilbert.ui.tables import (
    create_deps_table,
    create_sessions_table,
    create_findings_table,
    create_papers_table,
    create_progress_table,
)

__all__ = [
    "COLORS",
    "terminal_width",
    "create_welcome_banner",
    "create_status_banner",
    "create_header",
    "print_banner",
    "print_banner_header",
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
    "create_deps_table",
    "create_sessions_table",
    "create_findings_table",
    "create_papers_table",
    "create_progress_table",
]
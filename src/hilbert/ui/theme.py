"""Theme constants and colors for Hilbert terminal UI."""

from rich.console import Console


COLORS = {
    "primary": "#10b981",
    "secondary": "#3b82f6",
    "accent": "#f59e0b",
    "success": "#10b981",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "info": "#06b6d4",
}


BORDER_STYLES = {
    "rounded": "rounded",
    "double": "double",
    "square": "square",
}


def get_color(color_name: str) -> str:
    """Get color hex value by name."""
    return COLORS.get(color_name, "#ffffff")


def terminal_width() -> int:
    """Get terminal width."""
    return Console().width


def center_text(text: str, width: int = None) -> str:
    """Center text in given width."""
    if width is None:
        width = terminal_width()
    lines = text.split("\n")
    centered = []
    for line in lines:
        padding = max(0, (width - len(line)) // 2)
        centered.append(" " * padding + line)
    return "\n".join(centered)
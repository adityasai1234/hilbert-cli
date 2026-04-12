"""Theme registry for Hilbert terminal UI."""

from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class Theme:
    """Theme configuration."""
    
    name: str
    description: str
    primary: str
    secondary: str
    accent: str
    success: str
    warning: str
    error: str
    info: str
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary."""
        return {
            "primary": self.primary,
            "secondary": self.secondary,
            "accent": self.accent,
            "success": self.success,
            "warning": self.warning,
            "error": self.error,
            "info": self.info,
        }


THEMES = {
    "default": Theme(
        name="default",
        description="Feynman-inspired green",
        primary="#10b981",
        secondary="#3b82f6",
        accent="#f59e0b",
        success="#10b981",
        warning="#f59e0b",
        error="#ef4444",
        info="#06b6d4",
    ),
    "dark": Theme(
        name="dark",
        description="Terminal native dark",
        primary="#22c55e",
        secondary="#3b82f6",
        accent="#f59e0b",
        success="#22c55e",
        warning="#f59e0b",
        error="#ef4444",
        info="#06b6d4",
    ),
    "light": Theme(
        name="light",
        description="Light mode",
        primary="#059669",
        secondary="#2563eb",
        accent="#d97706",
        success="#059669",
        warning="#d97706",
        error="#dc2626",
        info="#0891b2",
    ),
    "mono": Theme(
        name="mono",
        description="Monochrome",
        primary="#ffffff",
        secondary="#cccccc",
        accent="#888888",
        success="#ffffff",
        warning="#cccccc",
        error="#888888",
        info="#aaaaaa",
    ),
}


def get_theme(name: str = "default") -> Theme:
    """Get theme by name."""
    return THEMES.get(name, THEMES["default"])


def list_themes() -> Dict[str, str]:
    """List all available themes."""
    return {name: theme.description for name, theme in THEMES.items()}


def get_current_theme_name() -> str:
    """Get the current theme name from environment."""
    import os
    return os.getenv("HILBERT_THEME", "default")


def get_current_theme() -> Theme:
    """Get the current theme."""
    return get_theme(get_current_theme_name())


def set_theme(name: str) -> bool:
    """Set the current theme via environment."""
    if name not in THEMES:
        return False
    import os
    os.environ["HILBERT_THEME"] = name
    return True
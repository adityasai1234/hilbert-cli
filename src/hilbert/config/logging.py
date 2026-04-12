"""Logging configuration for Hilbert."""

import logging
import sys
from pathlib import Path
from typing import Optional

from rich.logging import RichHandler

from hilbert.config.settings import get_settings


def setup_logging(
    name: str = "hilbert",
    log_file: Optional[Path] = None,
    level: str = "INFO",
) -> logging.Logger:
    """Setup logging with Rich handler."""
    settings = get_settings()
    
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
    if level:
        log_level = getattr(logging, level.upper(), logging.INFO)
    
    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    
    if logger.handlers:
        return logger
    
    console_handler = RichHandler(
        console=None,
        rich_tracebacks=True,
        markup=True,
        show_time=True,
        show_level=True,
        show_path=False,
    )
    console_handler.setLevel(log_level)
    logger.addHandler(console_handler)
    
    if log_file or settings.log_dir:
        log_path = log_file or settings.log_dir / "hilbert.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_path)
        file_handler.setLevel(log_level)
        file_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    logger.propagate = False
    
    return logger


def get_logger(name: str = "hilbert") -> logging.Logger:
    """Get Hilbert logger."""
    return logging.getLogger(name)
"""Tests for hilbert CLI."""

import pytest

from hilbert import __version__
from hilbert.cli import app


class TestCLI:
    def test_version_command(self):
        runner = app
        assert __version__ == "0.1.0"

    def test_cli_module(self):
        from hilbert import cli
        assert hasattr(cli, "app")

    def test_research_import(self):
        from hilbert.graph import run_research
        assert callable(run_research)

    def test_session_manager_import(self):
        from hilbert.persistence import SessionManager
        assert callable(SessionManager)
"""Tests for hilbert config."""

from pathlib import Path

import pytest

from hilbert.config.settings import HilbertSettings


class TestHilbertSettings:
    def test_defaults(self):
        settings = HilbertSettings()
        assert settings.max_rounds == 3
        assert settings.sub_questions == 4
        assert settings.top_k == 20
        assert settings.confidence_threshold == 0.75

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("HILBERT_MAX_ROUNDS", "5")
        monkeypatch.setenv("HILBERT_MODEL", "gpt-4")
        settings = HilbertSettings()
        assert settings.max_rounds == 5
        assert settings.model == "gpt-4"

    def test_path_defaults(self):
        settings = HilbertSettings()
        assert settings.output_dir == Path("outputs")
        assert settings.log_dir == Path("logs")
        assert settings.db_path == Path("hilbert.db")


class TestGetSettings:
    def test_returns_settings(self):
        from hilbert.config.settings import get_settings
        settings = get_settings()
        assert isinstance(settings, HilbertSettings)
"""Tests for research state."""

import pytest

from hilbert.state.research import create_initial_state, ResearchState


class TestResearchState:
    def test_create_initial_state(self):
        state = create_initial_state("test query", max_rounds=3)
        assert state["query"] == "test query"
        assert state["round"] == 0
        assert state["max_rounds"] == 3
        assert state["sub_questions"] == []
        assert state["papers"] == []
        assert state["findings"] == []
        assert state["report"] is None
        assert state["status"] == "planning"

    def test_create_initial_state_default_rounds(self):
        state = create_initial_state("test query")
        assert state["max_rounds"] == 3

    def test_initial_state_type(self):
        state = create_initial_state("test")
        assert isinstance(state, dict)
        assert "query" in state
        assert "round" in state
        assert "max_rounds" in state
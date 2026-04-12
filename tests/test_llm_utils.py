"""Tests for LLM utilities."""

import pytest

from hilbert.llm.utils import (
    parse_json_response,
    parse_json_list,
    parse_json_object,
    clean_json_string,
)


class TestParseJsonResponse:
    def test_parse_simple_list(self):
        text = '["a", "b", "c"]'
        result = parse_json_response(text)
        assert result == ["a", "b", "c"]

    def test_parse_simple_object(self):
        text = '{"key": "value"}'
        result = parse_json_response(text)
        assert result == {"key": "value"}

    def test_parse_with_code_fences(self):
        text = '```json\n["a", "b"]\n```'
        result = parse_json_response(text)
        assert result == ["a", "b"]

    def test_parse_with_braces_only(self):
        text = 'Some text {"key": "value"} more text'
        result = parse_json_response(text)
        assert result == {"key": "value"}

    def test_parse_empty(self):
        assert parse_json_response("") is None
        assert parse_json_response(None) is None


class TestParseJsonList:
    def test_parse_list(self):
        text = '["item1", "item2"]'
        result = parse_json_list(text)
        assert result == ["item1", "item2"]

    def test_parse_non_list_returns_empty(self):
        text = '{"key": "value"}'
        result = parse_json_list(text)
        assert result == []


class TestParseJsonObject:
    def test_parse_object(self):
        text = '{"key": "value"}'
        result = parse_json_object(text)
        assert result == {"key": "value"}

    def test_parse_non_object_returns_none(self):
        text = '["item1", "item2"]'
        result = parse_json_object(text)
        assert result is None


class TestCleanJsonString:
    def test_remove_comments(self):
        text = '{"key": "value"} // comment'
        result = clean_json_string(text)
        assert "// comment" not in result

    def test_remove_block_comments(self):
        text = '{"key": "value"} /* comment */'
        result = clean_json_string(text)
        assert "/*" not in result
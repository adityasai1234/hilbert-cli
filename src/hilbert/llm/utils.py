"""JSON parsing utilities for LLM responses."""

import json
import re
from typing import Any, List, Optional


def parse_json_response(text: str) -> Optional[Any]:
    """Parse JSON from LLM response, handling various formats."""
    if not text:
        return None

    text = text.strip()

    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
        elif text.startswith("javascript"):
            text = text[10:].strip()
        text = text.strip("`")

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    brace_start = text.find("{")
    bracket_start = text.find("[")

    if brace_start >= 0 and (bracket_start < 0 or brace_start < bracket_start):
        brace_end = text.rfind("}")
        if brace_end >= 0:
            text = text[brace_start:brace_end + 1]

    elif bracket_start >= 0:
        bracket_end = text.rfind("]")
        if bracket_end >= 0:
            text = text[bracket_start:bracket_end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    return None


def parse_json_list(text: str) -> List[Any]:
    """Parse JSON list from LLM response."""
    result = parse_json_response(text)
    if isinstance(result, list):
        return result
    return []


def parse_json_object(text: str) -> Optional[dict]:
    """Parse JSON object from LLM response."""
    result = parse_json_response(text)
    if isinstance(result, dict):
        return result
    return None


def extract_json_blocks(text: str) -> List[str]:
    """Extract all JSON blocks from text."""
    blocks = []
    in_block = False
    current = []
    depth = 0

    for line in text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("```"):
            if in_block:
                blocks.append("\n".join(current))
                current = []
                in_block = False
            elif stripped in ("```json", "```javascript", "```"):
                in_block = True
            continue

        if in_block or stripped.startswith(("{", "[")):
            in_block = True

        if in_block:
            current.append(line)

            for char in stripped:
                if char in "{[":
                    depth += 1
                elif char in "}]":
                    depth -= 1

            if depth == 0 and current:
                blocks.append("\n".join(current))
                current = []
                in_block = False

    if current:
        blocks.append("\n".join(current))

    return blocks


def clean_json_string(text: str) -> str:
    """Clean and normalize JSON string."""
    text = re.sub(r'//.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    return text.strip()
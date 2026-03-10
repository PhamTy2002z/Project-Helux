# ruff: noqa: INP001,S101
"""OpenClaw usage parser tests for cost extraction and coercion."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.schemas.openclaw_usage import (
    OpenClawUsageParseError,
    _coerce_cost,
    _extract_cost_fields,
    parse_session_usage_total_tokens,
)


def test_parse_session_usage_extracts_cost_fields() -> None:
    """Cost and missingCostEntries are parsed from usage payload."""
    payload = {
        "sessions": [
            {
                "key": "agent:test:main",
                "totalTokens": 1000,
                "usage": {
                    "totalTokens": 1000,
                    "totalCost": 0.50,
                    "missingCostEntries": 0,
                },
            },
        ],
    }
    result = parse_session_usage_total_tokens(payload, session_key="agent:test:main")
    assert result.session_key == "agent:test:main"
    assert result.total_tokens == 1000
    assert result.total_cost == Decimal("0.50")
    assert result.missing_cost_entries == 0


def test_parse_session_usage_defaults_cost_when_missing() -> None:
    """Backward compat: cost defaults to 0 when missing."""
    payload = {
        "sessions": [
            {
                "key": "agent:test:main",
                "totalTokens": 500,
            },
        ],
    }
    result = parse_session_usage_total_tokens(payload, session_key="agent:test:main")
    assert result.session_key == "agent:test:main"
    assert result.total_tokens == 500
    assert result.total_cost == Decimal(0)
    assert result.missing_cost_entries == 0


def test_coerce_cost_handles_decimal() -> None:
    """Decimal values are accepted and preserved."""
    assert _coerce_cost(Decimal("1.25")) == Decimal("1.25")
    assert _coerce_cost(Decimal("0")) == Decimal("0")


def test_coerce_cost_handles_int() -> None:
    """Integer values are converted to Decimal."""
    assert _coerce_cost(42) == Decimal("42")
    assert _coerce_cost(0) == Decimal("0")


def test_coerce_cost_handles_float() -> None:
    """Float values are converted to Decimal."""
    assert _coerce_cost(1.5) == Decimal("1.5")
    assert _coerce_cost(0.0) == Decimal("0")


def test_coerce_cost_handles_string() -> None:
    """String values are converted if valid."""
    assert _coerce_cost("10.50") == Decimal("10.50")
    assert _coerce_cost("  50.00  ") == Decimal("50.00")
    assert _coerce_cost("0") == Decimal("0")


def test_coerce_cost_rejects_negative_values() -> None:
    """Negative values return None."""
    assert _coerce_cost(-1) is None
    assert _coerce_cost(-0.5) is None
    assert _coerce_cost(Decimal("-10")) is None
    assert _coerce_cost("-5.00") is None


def test_coerce_cost_rejects_bool() -> None:
    """Boolean values return None."""
    assert _coerce_cost(True) is None
    assert _coerce_cost(False) is None


def test_coerce_cost_rejects_invalid_strings() -> None:
    """Invalid string values return None."""
    assert _coerce_cost("") is None
    assert _coerce_cost("  ") is None
    assert _coerce_cost("not-a-number") is None
    assert _coerce_cost("1.2.3") is None


def test_coerce_cost_rejects_none_and_other_types() -> None:
    """None and unexpected types return None."""
    assert _coerce_cost(None) is None
    assert _coerce_cost([]) is None
    assert _coerce_cost({}) is None


def test_extract_cost_fields_from_nested_usage() -> None:
    """Cost fields extracted from nested usage dict."""
    session_item = {
        "usage": {
            "totalCost": 2.50,
            "missingCostEntries": 5,
        },
    }
    cost, missing = _extract_cost_fields(session_item)
    assert cost == Decimal("2.50")
    assert missing == 5


def test_extract_cost_fields_from_flat_structure() -> None:
    """Cost fields extracted from flat session item."""
    session_item = {
        "totalCost": 1.00,
        "missingCostEntries": 0,
    }
    cost, missing = _extract_cost_fields(session_item)
    assert cost == Decimal("1.00")
    assert missing == 0


def test_extract_cost_fields_defaults_when_missing() -> None:
    """Defaults applied when cost fields missing."""
    session_item = {}
    cost, missing = _extract_cost_fields(session_item)
    assert cost == Decimal(0)
    assert missing == 0


def test_extract_cost_fields_ignores_invalid_missing_count() -> None:
    """Invalid missingCostEntries becomes 0."""
    session_item = {
        "totalCost": 1.50,
        "missingCostEntries": "not-a-number",
    }
    cost, missing = _extract_cost_fields(session_item)
    assert cost == Decimal("1.50")
    assert missing == 0


def test_extract_cost_fields_rejects_negative_missing_count() -> None:
    """Negative missingCostEntries become 0."""
    session_item = {
        "totalCost": 1.00,
        "missingCostEntries": -5,
    }
    cost, missing = _extract_cost_fields(session_item)
    assert cost == Decimal("1.00")
    assert missing == 0


def test_parse_session_usage_requires_session_key() -> None:
    """Empty session key raises parse error."""
    with pytest.raises(OpenClawUsageParseError) as exc_info:
        parse_session_usage_total_tokens({}, session_key="")
    assert "session key is required" in str(exc_info.value)


def test_parse_session_usage_requires_sessions() -> None:
    """Missing sessions list raises parse error."""
    with pytest.raises(OpenClawUsageParseError) as exc_info:
        parse_session_usage_total_tokens([], session_key="agent:test:main")
    assert "session items" in str(exc_info.value)

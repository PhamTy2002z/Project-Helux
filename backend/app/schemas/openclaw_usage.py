"""Typed parsing helpers for OpenClaw `sessions.usage` payloads."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


class OpenClawUsageParseError(ValueError):
    """Raised when `sessions.usage` payload shape is invalid."""


@dataclass(frozen=True, slots=True)
class OpenClawSessionUsage:
    """Normalized usage projection for one OpenClaw session."""

    session_key: str
    total_tokens: int
    total_cost: Decimal = Decimal(0)
    missing_cost_entries: int = 0


def _as_session_items(payload: object) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        if isinstance(payload.get("sessions"), list):
            return [item for item in payload["sessions"] if isinstance(item, dict)]
        return [payload]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def _coerce_token_count(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float):
        if value < 0 or not value.is_integer():
            return None
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            return int(stripped)
    return None


def _coerce_cost(value: object) -> Decimal | None:
    """Coerce a cost value to Decimal. Reject negative values."""
    if isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value if value >= 0 else None
    if isinstance(value, (int, float)):
        if value < 0:
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            result = Decimal(stripped)
            return result if result >= 0 else None
        except (InvalidOperation, ValueError):
            return None
    return None


def _extract_total_tokens(session_item: dict[str, Any]) -> int | None:
    usage_value = session_item.get("usage")
    if isinstance(usage_value, dict):
        value = _coerce_token_count(usage_value.get("totalTokens"))
        if value is not None:
            return value
    return _coerce_token_count(session_item.get("totalTokens"))


def _extract_cost_fields(session_item: dict[str, Any]) -> tuple[Decimal, int]:
    """Extract totalCost and missingCostEntries from session item."""
    usage_value = session_item.get("usage")
    source = usage_value if isinstance(usage_value, dict) else session_item

    total_cost = _coerce_cost(source.get("totalCost")) or Decimal(0)
    raw_missing = source.get("missingCostEntries")
    missing_cost_entries = 0
    if isinstance(raw_missing, bool):
        missing_cost_entries = 0
    elif isinstance(raw_missing, int) and raw_missing >= 0:
        missing_cost_entries = raw_missing
    return total_cost, missing_cost_entries


def parse_session_usage_total_tokens(
    payload: object,
    *,
    session_key: str,
) -> OpenClawSessionUsage:
    """Parse `sessions.usage` payload to one validated session usage tuple."""
    normalized_key = session_key.strip()
    if not normalized_key:
        raise OpenClawUsageParseError("session key is required for usage parsing")

    sessions = _as_session_items(payload)
    if not sessions:
        raise OpenClawUsageParseError("sessions.usage response does not include session items")

    selected = sessions[0]
    for item in sessions:
        value = item.get("key")
        if isinstance(value, str) and value.strip() == normalized_key:
            selected = item
            break

    total_tokens = _extract_total_tokens(selected)
    if total_tokens is None:
        raise OpenClawUsageParseError(
            "sessions.usage response missing numeric usage.totalTokens for selected session",
        )

    total_cost, missing_cost_entries = _extract_cost_fields(selected)

    return OpenClawSessionUsage(
        session_key=normalized_key,
        total_tokens=total_tokens,
        total_cost=total_cost,
        missing_cost_entries=missing_cost_entries,
    )

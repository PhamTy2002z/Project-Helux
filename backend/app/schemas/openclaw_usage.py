"""Typed parsing helpers for OpenClaw `sessions.usage` payloads."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class OpenClawUsageParseError(ValueError):
    """Raised when `sessions.usage` payload shape is invalid."""


@dataclass(frozen=True, slots=True)
class OpenClawSessionUsage:
    """Normalized usage projection for one OpenClaw session."""

    session_key: str
    total_tokens: int


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


def _extract_total_tokens(session_item: dict[str, Any]) -> int | None:
    usage_value = session_item.get("usage")
    if isinstance(usage_value, dict):
        value = _coerce_token_count(usage_value.get("totalTokens"))
        if value is not None:
            return value
    return _coerce_token_count(session_item.get("totalTokens"))


def parse_session_usage_total_tokens(
    payload: object,
    *,
    session_key: str,
) -> OpenClawSessionUsage:
    """Parse `sessions.usage` payload to one validated `session_key -> total_tokens` tuple."""
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

    return OpenClawSessionUsage(
        session_key=normalized_key,
        total_tokens=total_tokens,
    )


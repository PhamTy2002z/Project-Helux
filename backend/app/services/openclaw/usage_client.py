"""OpenClaw `sessions.usage` typed client helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.logging import get_logger
from app.schemas.openclaw_usage import (
    OpenClawSessionUsage,
    OpenClawUsageParseError,
    parse_session_usage_total_tokens,
)
from app.services.openclaw.gateway_rpc import GatewayConfig, OpenClawGatewayError, openclaw_call

_USAGE_METHOD_NAME = "sessions.usage"
_UNSUPPORTED_USAGE_PATTERNS = (
    re.compile(r"\bmethod\b.+\bnot\s+found\b", re.IGNORECASE),
    re.compile(r"\bunknown\s+method\b", re.IGNORECASE),
    re.compile(r"\bnot\s+implemented\b", re.IGNORECASE),
    re.compile(r"\bunsupported\b.+\bmethod\b", re.IGNORECASE),
    re.compile(r"\bsessions\.usage\b.+\bnot\s+available\b", re.IGNORECASE),
)
logger = get_logger(__name__)


class OpenClawUsageClientError(RuntimeError):
    """Base error for `sessions.usage` client failures."""


class OpenClawUsageUnsupportedError(OpenClawUsageClientError):
    """Raised when target gateway runtime does not support `sessions.usage`."""


class OpenClawUsagePayloadError(OpenClawUsageClientError):
    """Raised when usage payload cannot be parsed to a valid token total."""


@dataclass(frozen=True, slots=True)
class SessionUsageQuery:
    """Query contract for one `sessions.usage` lookup."""

    session_key: str
    start_date: str
    end_date: str
    mode: str = "specific"
    utc_offset: str = "UTC+7"


def _is_usage_unsupported_message(message: str) -> bool:
    normalized = message.strip()
    if not normalized:
        return False
    lowered = normalized.lower()
    if _USAGE_METHOD_NAME not in lowered:
        return False
    return any(pattern.search(normalized) for pattern in _UNSUPPORTED_USAGE_PATTERNS)


def is_usage_unsupported_error(exc: OpenClawGatewayError) -> bool:
    """Return whether gateway error indicates unsupported `sessions.usage`."""
    return _is_usage_unsupported_message(str(exc))


def _usage_params(query: SessionUsageQuery) -> dict[str, object]:
    return {
        "key": query.session_key,
        "startDate": query.start_date,
        "endDate": query.end_date,
        "mode": query.mode,
        "utcOffset": query.utc_offset,
    }


async def fetch_session_usage(
    *,
    config: GatewayConfig,
    query: SessionUsageQuery,
) -> OpenClawSessionUsage:
    """Fetch and parse one session usage snapshot from OpenClaw."""
    try:
        payload = await openclaw_call(
            _USAGE_METHOD_NAME,
            _usage_params(query),
            config=config,
        )
    except OpenClawGatewayError as exc:
        if is_usage_unsupported_error(exc):
            raise OpenClawUsageUnsupportedError(str(exc)) from exc
        raise

    try:
        return parse_session_usage_total_tokens(
            payload,
            session_key=query.session_key,
        )
    except OpenClawUsageParseError as exc:
        raise OpenClawUsagePayloadError(str(exc)) from exc


async def probe_sessions_usage_capability(*, config: GatewayConfig) -> bool:
    """Probe runtime support for `sessions.usage` without depending on session existence."""
    try:
        await openclaw_call(
            _USAGE_METHOD_NAME,
            {
                "startDate": "1970-01-01",
                "endDate": "1970-01-01",
                "mode": "specific",
                "utcOffset": "UTC+7",
                "limit": 1,
            },
            config=config,
        )
        return True
    except OpenClawGatewayError as exc:
        if is_usage_unsupported_error(exc):
            logger.info("gateway.usage.capability.unsupported reason=%s", str(exc))
            return False
        # Method is reachable; failure reason is unrelated to support.
        return True

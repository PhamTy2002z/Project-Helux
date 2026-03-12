# ruff: noqa: S101
from __future__ import annotations

import pytest

import app.services.openclaw.usage_client as usage_client
from app.schemas.openclaw_usage import OpenClawUsageParseError, parse_session_usage_total_tokens
from app.services.openclaw.gateway_rpc import GatewayConfig, OpenClawGatewayError
from app.services.openclaw.usage_client import (
    OpenClawUsagePayloadError,
    OpenClawUsageUnsupportedError,
    SessionUsageQuery,
    fetch_session_usage,
    probe_sessions_usage_capability,
)


def test_parse_session_usage_total_tokens_prefers_matching_session_key() -> None:
    payload = {
        "sessions": [
            {"key": "agent:other:main", "usage": {"totalTokens": 15}},
            {"key": "agent:target:main", "usage": {"totalTokens": 87}},
        ],
    }

    usage = parse_session_usage_total_tokens(payload, session_key="agent:target:main")

    assert usage.session_key == "agent:target:main"
    assert usage.total_tokens == 87


def test_parse_session_usage_total_tokens_raises_for_invalid_payload() -> None:
    with pytest.raises(OpenClawUsageParseError):
        parse_session_usage_total_tokens({"sessions": [{"key": "agent:x"}]}, session_key="agent:x")


@pytest.mark.asyncio
async def test_fetch_session_usage_maps_unsupported_method_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_openclaw_call(method: str, params: object, *, config: GatewayConfig) -> object:
        _ = (method, params, config)
        raise OpenClawGatewayError("sessions.usage method not found")

    monkeypatch.setattr(usage_client, "openclaw_call", _fake_openclaw_call)

    with pytest.raises(OpenClawUsageUnsupportedError):
        await fetch_session_usage(
            config=GatewayConfig(url="ws://gateway.example/ws"),
            query=SessionUsageQuery(
                session_key="agent:demo:main",
                start_date="2026-03-09",
                end_date="2026-03-09",
            ),
        )


@pytest.mark.asyncio
async def test_fetch_session_usage_maps_parse_failures_to_payload_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_openclaw_call(method: str, params: object, *, config: GatewayConfig) -> object:
        _ = (method, params, config)
        return {"sessions": [{"key": "agent:demo:main"}]}

    monkeypatch.setattr(usage_client, "openclaw_call", _fake_openclaw_call)

    with pytest.raises(OpenClawUsagePayloadError):
        await fetch_session_usage(
            config=GatewayConfig(url="ws://gateway.example/ws"),
            query=SessionUsageQuery(
                session_key="agent:demo:main",
                start_date="2026-03-09",
                end_date="2026-03-09",
            ),
        )


@pytest.mark.asyncio
async def test_probe_sessions_usage_capability_treats_non_support_errors_as_supported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_openclaw_call(method: str, params: object, *, config: GatewayConfig) -> object:
        _ = (method, params, config)
        raise OpenClawGatewayError("invalid date range")

    monkeypatch.setattr(usage_client, "openclaw_call", _fake_openclaw_call)

    assert (
        await probe_sessions_usage_capability(
            config=GatewayConfig(url="ws://gateway.example/ws"),
        )
        is True
    )


@pytest.mark.asyncio
async def test_probe_sessions_usage_capability_detects_unsupported_method(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fake_openclaw_call(method: str, params: object, *, config: GatewayConfig) -> object:
        _ = (method, params, config)
        raise OpenClawGatewayError("sessions.usage method not found")

    monkeypatch.setattr(usage_client, "openclaw_call", _fake_openclaw_call)

    assert (
        await probe_sessions_usage_capability(
            config=GatewayConfig(url="ws://gateway.example/ws"),
        )
        is False
    )

# ruff: noqa: S101
from __future__ import annotations

import pytest

import app.services.openclaw.usage_capability as usage_capability
from app.core.config import settings
from app.services.openclaw.gateway_compat import check_gateway_sessions_usage_capability
from app.services.openclaw.gateway_rpc import GatewayConfig


@pytest.mark.asyncio
async def test_check_gateway_sessions_usage_capability_uses_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    usage_capability._CAPABILITY_CACHE.clear()  # noqa: SLF001
    monkeypatch.setattr(settings, "openclaw_usage_capability_ttl_seconds", 300)
    calls = 0

    async def _fake_probe(*, config: GatewayConfig) -> bool:
        nonlocal calls
        _ = config
        calls += 1
        return False

    monkeypatch.setattr(usage_capability, "probe_sessions_usage_capability", _fake_probe)
    config = GatewayConfig(url="ws://gateway.example/ws")

    first = await check_gateway_sessions_usage_capability(config)
    second = await check_gateway_sessions_usage_capability(config)

    assert first.supported is False
    assert first.code == "sessions_usage_unsupported"
    assert second.supported is False
    assert calls == 1


@pytest.mark.asyncio
async def test_check_gateway_sessions_usage_capability_force_refresh_bypasses_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    usage_capability._CAPABILITY_CACHE.clear()  # noqa: SLF001
    monkeypatch.setattr(settings, "openclaw_usage_capability_ttl_seconds", 300)
    calls = 0

    async def _fake_probe(*, config: GatewayConfig) -> bool:
        nonlocal calls
        _ = config
        calls += 1
        return True

    monkeypatch.setattr(usage_capability, "probe_sessions_usage_capability", _fake_probe)
    config = GatewayConfig(url="ws://gateway.example/ws")

    await check_gateway_sessions_usage_capability(config)
    await check_gateway_sessions_usage_capability(config, force_refresh=True)

    assert calls == 2

"""Cached gateway capability checks for OpenClaw usage synchronization."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import monotonic

from app.core.config import settings
from app.services.openclaw.gateway_rpc import GatewayConfig
from app.services.openclaw.usage_client import probe_sessions_usage_capability

_CAPABILITY_CODE_SUPPORTED = "supported"
_CAPABILITY_CODE_UNSUPPORTED = "sessions_usage_unsupported"
_CAPABILITY_CACHE: dict[str, tuple[float, "GatewayUsageCapabilityResult"]] = {}
_CAPABILITY_CACHE_LOCK = asyncio.Lock()


@dataclass(frozen=True, slots=True)
class GatewayUsageCapabilityResult:
    """Cached capability verdict for one gateway runtime."""

    supported: bool
    code: str
    message: str | None = None


def _cache_key(config: GatewayConfig) -> str:
    return (
        f"url={config.url.strip()}|"
        f"insecure={str(config.allow_insecure_tls).lower()}|"
        f"pairing_disabled={str(config.disable_device_pairing).lower()}"
    )


def _ttl_seconds() -> int:
    return max(int(settings.openclaw_usage_capability_ttl_seconds), 0)


async def check_sessions_usage_capability(
    config: GatewayConfig,
    *,
    force_refresh: bool = False,
) -> GatewayUsageCapabilityResult:
    """Return cached `sessions.usage` capability verdict for a gateway config."""
    key = _cache_key(config)
    ttl_seconds = _ttl_seconds()
    now = monotonic()

    if ttl_seconds > 0 and not force_refresh:
        async with _CAPABILITY_CACHE_LOCK:
            cached = _CAPABILITY_CACHE.get(key)
            if cached is not None:
                expires_at, cached_result = cached
                if expires_at > now:
                    return cached_result

    supported = await probe_sessions_usage_capability(config=config)
    result = (
        GatewayUsageCapabilityResult(
            supported=True,
            code=_CAPABILITY_CODE_SUPPORTED,
            message=None,
        )
        if supported
        else GatewayUsageCapabilityResult(
            supported=False,
            code=_CAPABILITY_CODE_UNSUPPORTED,
            message="Gateway runtime does not expose OpenClaw sessions.usage.",
        )
    )

    if ttl_seconds > 0:
        async with _CAPABILITY_CACHE_LOCK:
            _CAPABILITY_CACHE[key] = (now + ttl_seconds, result)
    return result

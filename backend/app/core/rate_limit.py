"""HTTP middleware for coarse-grained request rate limiting."""

from __future__ import annotations

import hashlib
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.services.rate_limit import RateLimitDecision, RateLimiter, RateLimitPolicy

_HEALTH_PATHS = frozenset({"/health", "/healthz", "/readyz"})


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for.strip():
        first = forwarded_for.split(",", 1)[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _actor_fingerprint(request: Request) -> str | None:
    auth = request.headers.get("authorization", "").strip()
    if auth:
        digest = hashlib.sha256(auth.encode("utf-8")).hexdigest()
        return f"auth:{digest[:24]}"
    agent_token = request.headers.get("x-agent-token", "").strip()
    if agent_token:
        digest = hashlib.sha256(agent_token.encode("utf-8")).hexdigest()
        return f"agent:{digest[:24]}"
    return None


def _rate_limited_response(*, scope: str, decision: RateLimitDecision) -> Response:
    payload = {
        "detail": {
            "code": "rate_limited",
            "message": "Too many requests.",
            "scope": scope,
            "limit": decision.limit,
            "retry_after_seconds": decision.retry_after_seconds,
        }
    }
    headers = {
        "X-RateLimit-Limit": str(decision.limit),
        "X-RateLimit-Remaining": str(decision.remaining),
    }
    if decision.retry_after_seconds is not None:
        headers["Retry-After"] = str(decision.retry_after_seconds)
    return JSONResponse(status_code=429, content=payload, headers=headers)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply per-IP and per-actor fixed-window limits to inbound requests."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._enabled = settings.rate_limit_enabled
        self._ip_policy = RateLimitPolicy(
            limit=settings.rate_limit_ip_limit_per_minute,
            window_seconds=60,
        )
        self._actor_policy = RateLimitPolicy(
            limit=settings.rate_limit_actor_limit_per_minute,
            window_seconds=60,
        )
        self._limiter = RateLimiter(
            redis_url=settings.rq_redis_url,
            prefix=settings.rate_limit_prefix,
        )

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not self._enabled or request.url.path in _HEALTH_PATHS:
            return await call_next(request)

        ip_key = _client_ip(request)
        ip_decision = self._limiter.check(key=f"ip:{ip_key}", policy=self._ip_policy)
        if not ip_decision.allowed:
            return _rate_limited_response(scope="ip", decision=ip_decision)

        actor_key = _actor_fingerprint(request)
        if actor_key is not None:
            actor_decision = self._limiter.check(key=actor_key, policy=self._actor_policy)
            if not actor_decision.allowed:
                return _rate_limited_response(scope="actor", decision=actor_decision)

        return await call_next(request)

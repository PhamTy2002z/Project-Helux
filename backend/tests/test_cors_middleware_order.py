# ruff: noqa: S101
"""Regression guard for middleware order impacting CORS headers."""

from __future__ import annotations

from fastapi.middleware.cors import CORSMiddleware

from app.core.error_handling import RequestIdMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.main import app


def test_cors_middleware_wraps_short_circuit_middlewares() -> None:
    """CORS must execute before middleware that may return early (e.g. 429)."""
    assert app.user_middleware, "expected configured middleware stack"
    classes = [middleware.cls for middleware in app.user_middleware]
    assert classes[0] is RequestIdMiddleware
    assert CORSMiddleware in classes
    assert RateLimitMiddleware in classes
    assert SecurityHeadersMiddleware in classes
    assert classes.index(CORSMiddleware) < classes.index(RateLimitMiddleware)
    assert classes.index(CORSMiddleware) < classes.index(SecurityHeadersMiddleware)

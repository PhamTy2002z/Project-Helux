# ruff: noqa: INP001
"""Rate limiter fallback behavior tests."""

from __future__ import annotations

import pytest

from app.services.rate_limit import RateLimiter, RateLimitPolicy


@pytest.mark.parametrize(
    ("limit", "expected_allowed"),
    [(2, [True, True, False]), (1, [True, False])],
)
def test_rate_limiter_uses_memory_fallback_when_redis_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    limit: int,
    expected_allowed: list[bool],
) -> None:
    limiter = RateLimiter(redis_url="redis://127.0.0.1:1/0", prefix="test-rl")

    def _raise_redis_error(*, namespaced_key: str, policy: RateLimitPolicy):
        _ = (namespaced_key, policy)
        raise RuntimeError("redis down")

    monkeypatch.setattr(limiter, "_check_redis", _raise_redis_error)

    policy = RateLimitPolicy(limit=limit, window_seconds=60)
    decisions = [limiter.check(key=f"same-key-{limit}", policy=policy) for _ in expected_allowed]

    assert [decision.allowed for decision in decisions] == expected_allowed
    assert decisions[-1].remaining == 0
    if not decisions[-1].allowed:
        assert decisions[-1].retry_after_seconds is not None

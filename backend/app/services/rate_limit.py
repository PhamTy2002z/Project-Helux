"""Redis-backed rate limit helper with in-process fallback."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock

import redis

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class RateLimitPolicy:
    """Fixed-window policy limits."""

    limit: int
    window_seconds: int


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """Decision payload returned after evaluating a rate-limit key."""

    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int | None = None


@dataclass(slots=True)
class _MemoryCounter:
    count: int
    expires_at: datetime


class RateLimiter:
    """Evaluate request limits against Redis, falling back to process-local counters."""

    _memory_store: dict[str, _MemoryCounter] = {}
    _memory_lock = Lock()

    def __init__(self, *, redis_url: str, prefix: str = "rl") -> None:
        self._redis_url = redis_url
        self._prefix = prefix
        self._client: redis.Redis | None = None

    def _redis_client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis.from_url(self._redis_url)
        return self._client

    def check(self, *, key: str, policy: RateLimitPolicy) -> RateLimitDecision:
        """Evaluate a key against configured limits."""
        if policy.limit <= 0 or policy.window_seconds <= 0:
            return RateLimitDecision(allowed=True, limit=policy.limit, remaining=policy.limit)

        namespaced_key = f"{self._prefix}:{key}"
        try:
            return self._check_redis(namespaced_key=namespaced_key, policy=policy)
        except Exception as exc:  # pragma: no cover - defensive fallback
            logger.warning(
                "rate_limit.redis_unavailable",
                extra={"key": key, "error": str(exc)},
            )
            return self._check_memory(namespaced_key=namespaced_key, policy=policy)

    def _check_redis(self, *, namespaced_key: str, policy: RateLimitPolicy) -> RateLimitDecision:
        client = self._redis_client()
        pipe = client.pipeline()
        pipe.incr(namespaced_key)
        pipe.expire(namespaced_key, policy.window_seconds, nx=True)
        pipe.ttl(namespaced_key)
        current_raw, _expire_set, ttl_raw = pipe.execute()  # type: ignore[no-untyped-call]

        current = int(current_raw or 0)
        ttl = int(ttl_raw or 0)
        remaining = max(policy.limit - current, 0)
        allowed = current <= policy.limit
        retry_after = ttl if not allowed and ttl > 0 else policy.window_seconds
        return RateLimitDecision(
            allowed=allowed,
            limit=policy.limit,
            remaining=remaining,
            retry_after_seconds=retry_after if not allowed else None,
        )

    def _check_memory(self, *, namespaced_key: str, policy: RateLimitPolicy) -> RateLimitDecision:
        now = datetime.utcnow()
        with self._memory_lock:
            counter = self._memory_store.get(namespaced_key)
            if counter is None or counter.expires_at <= now:
                counter = _MemoryCounter(
                    count=1,
                    expires_at=now + timedelta(seconds=policy.window_seconds),
                )
                self._memory_store[namespaced_key] = counter
            else:
                counter.count += 1

            remaining = max(policy.limit - counter.count, 0)
            allowed = counter.count <= policy.limit
            retry_after = max(int((counter.expires_at - now).total_seconds()), 1)
            return RateLimitDecision(
                allowed=allowed,
                limit=policy.limit,
                remaining=remaining,
                retry_after_seconds=retry_after if not allowed else None,
            )

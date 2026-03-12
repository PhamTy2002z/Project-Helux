"""Runtime metrics helpers for board planning overlay observability."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from threading import Lock

LATENCY_WINDOW_MAX = 512

_lock = Lock()
_latency_samples_ms: deque[float] = deque(maxlen=LATENCY_WINDOW_MAX)
_filter_usage_count = 0
_cursor_usage_count = 0
_agent_task_loop_regression_count = 0


@dataclass(frozen=True)
class BoardOverlayRuntimeSnapshot:
    """Current in-memory board overlay telemetry snapshot."""

    samples: int
    avg_ms: float
    p95_ms: float | None
    max_ms: float | None
    filter_usage_count: int
    cursor_usage_count: int
    agent_task_loop_regression_count: int


def _percentile(sorted_values: list[float], percentile: float) -> float | None:
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * percentile
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    weight = rank - low
    return sorted_values[low] * (1 - weight) + sorted_values[high] * weight


def reset_board_overlay_runtime_metrics() -> None:
    """Reset process-local telemetry (used by deterministic tests)."""
    global _filter_usage_count
    global _cursor_usage_count
    global _agent_task_loop_regression_count

    with _lock:
        _latency_samples_ms.clear()
        _filter_usage_count = 0
        _cursor_usage_count = 0
        _agent_task_loop_regression_count = 0


def record_board_query_latency(
    *,
    latency_ms: float,
    used_cursor: bool,
    used_filters: bool,
) -> None:
    """Record latency and usage dimensions for board task-list reads."""
    global _filter_usage_count
    global _cursor_usage_count

    with _lock:
        _latency_samples_ms.append(max(latency_ms, 0.0))
        if used_filters:
            _filter_usage_count += 1
        if used_cursor:
            _cursor_usage_count += 1


def record_agent_task_loop_regression() -> None:
    """Increment loop-regression marker when agent-task selection path fails."""
    global _agent_task_loop_regression_count

    with _lock:
        _agent_task_loop_regression_count += 1


def get_board_overlay_runtime_snapshot() -> BoardOverlayRuntimeSnapshot:
    """Read a process-local telemetry snapshot for metrics endpoints."""
    with _lock:
        samples = list(_latency_samples_ms)
        samples_count = len(samples)
        avg_ms = sum(samples) / samples_count if samples_count else 0.0
        max_ms = max(samples) if samples else None
        p95_ms = _percentile(sorted(samples), 0.95)
        return BoardOverlayRuntimeSnapshot(
            samples=samples_count,
            avg_ms=avg_ms,
            p95_ms=p95_ms,
            max_ms=max_ms,
            filter_usage_count=_filter_usage_count,
            cursor_usage_count=_cursor_usage_count,
            agent_task_loop_regression_count=_agent_task_loop_regression_count,
        )

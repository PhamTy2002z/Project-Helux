# ruff: noqa: INP001
"""Queue worker registration tests for gateway activation tasks."""

from __future__ import annotations

from app.services.openclaw.gateway_activation_queue import TASK_TYPE as GATEWAY_ACTIVATION_TASK_TYPE
from app.services.queue_worker import _TASK_HANDLERS


def test_worker_registers_gateway_activation_handler() -> None:
    assert GATEWAY_ACTIVATION_TASK_TYPE in _TASK_HANDLERS

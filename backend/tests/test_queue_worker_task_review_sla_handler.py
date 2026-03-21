# ruff: noqa: INP001
"""Queue worker registration tests for task review-SLA deadline tasks."""

from __future__ import annotations

from app.services.queue_worker import _TASK_HANDLERS
from app.services.task_review_sla_queue import TASK_TYPE as TASK_REVIEW_SLA_TASK_TYPE


def test_worker_registers_task_review_sla_handler() -> None:
    assert TASK_REVIEW_SLA_TASK_TYPE in _TASK_HANDLERS

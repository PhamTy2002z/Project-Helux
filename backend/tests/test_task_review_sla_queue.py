# ruff: noqa: INP001
"""Queue payload tests for task review-SLA deadline tasks."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.services.queue import QueuedTask
from app.services.task_review_sla_queue import TASK_TYPE, decode_task_review_sla_deadline


def test_decode_task_review_sla_deadline_extracts_uuid() -> None:
    task_id = uuid4()
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"task_id": str(task_id)},
        created_at=datetime.now(UTC),
    )
    assert decode_task_review_sla_deadline(task) == task_id


def test_decode_task_review_sla_deadline_invalid_uuid_raises() -> None:
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"task_id": "invalid"},
        created_at=datetime.now(UTC),
    )
    with pytest.raises(ValueError):
        decode_task_review_sla_deadline(task)


def test_decode_task_review_sla_deadline_missing_key_raises() -> None:
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={},
        created_at=datetime.now(UTC),
    )
    with pytest.raises(KeyError):
        decode_task_review_sla_deadline(task)

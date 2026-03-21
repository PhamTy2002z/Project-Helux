"""Queue helpers for task review-SLA deadline checks."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.services.queue import QueuedTask, enqueue_task_with_delay
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

TASK_TYPE = "task_review_sla_deadline"


def enqueue_task_review_sla_deadline(
    task_id: UUID,
    *,
    delay_seconds: float,
) -> bool:
    """Schedule one review-SLA check for a task."""
    queued = QueuedTask(
        task_type=TASK_TYPE,
        payload={"task_id": str(task_id)},
        created_at=datetime.now(UTC),
    )
    return enqueue_task_with_delay(
        queued,
        settings.rq_queue_name,
        delay_seconds=max(0.0, delay_seconds),
        redis_url=settings.rq_redis_url,
    )


def decode_task_review_sla_deadline(task: QueuedTask) -> UUID:
    """Extract `task_id` from a queued review-SLA task."""
    payload: dict[str, Any] = task.payload
    return UUID(payload["task_id"])


def requeue_task_review_sla_deadline(task: QueuedTask, delay_seconds: float = 0) -> bool:
    """Requeue a failed review-SLA check task."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.task_review_sla_queue_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=delay_seconds,
    )

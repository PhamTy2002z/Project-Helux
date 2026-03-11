"""Queue helpers for file report deadline check tasks."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.services.queue import QueuedTask, enqueue_task_with_delay
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "board_chat_file_report_deadline"


def enqueue_report_deadline(
    file_task_id: UUID,
    *,
    delay_seconds: float | None = None,
) -> bool:
    """Schedule a deadline check for a file report task."""
    if delay_seconds is None:
        delay_seconds = float(settings.board_chat_file_report_timeout_seconds)

    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"file_task_id": str(file_task_id)},
        created_at=datetime.now(UTC),
    )
    return enqueue_task_with_delay(
        task,
        settings.rq_queue_name,
        delay_seconds=delay_seconds,
        redis_url=settings.rq_redis_url,
    )


def decode_deadline_task(task: QueuedTask) -> UUID:
    """Extract file_task_id from a queued deadline task."""
    payload: dict[str, Any] = task.payload
    return UUID(payload["file_task_id"])


def requeue_deadline_task(task: QueuedTask, delay_seconds: float = 0) -> bool:
    """Requeue a failed deadline task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.board_chat_file_report_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=delay_seconds,
    )

"""Queue helpers for board chat file extraction tasks."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.services.queue import QueuedTask, enqueue_task
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "board_chat_file_extract"


def enqueue_extraction(file_asset_id: UUID) -> bool:
    """Enqueue a file extraction task for async processing."""
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"file_asset_id": str(file_asset_id)},
        created_at=datetime.now(UTC),
    )
    return enqueue_task(task, settings.rq_queue_name, redis_url=settings.rq_redis_url)


def decode_extraction_task(task: QueuedTask) -> UUID:
    """Extract file_asset_id from a queued extraction task."""
    payload: dict[str, Any] = task.payload
    return UUID(payload["file_asset_id"])


def requeue_extraction_task(task: QueuedTask, delay_seconds: float = 0) -> bool:
    """Requeue a failed extraction task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=delay_seconds,
    )

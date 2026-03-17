"""Queue helpers for async Polar webhook processing."""

from __future__ import annotations

from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.services.queue import QueuedTask, enqueue_task
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "billing_webhook_process"


def enqueue_billing_webhook_task(*, webhook_event_id: UUID) -> bool:
    """Enqueue a Polar webhook event for async processing."""
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"webhook_event_id": str(webhook_event_id)},
        created_at=utcnow(),
    )
    ok = enqueue_task(task, settings.rq_queue_name, redis_url=settings.rq_redis_url)
    if ok:
        logger.info("Enqueued billing webhook task for event %s", webhook_event_id)
    return ok


def requeue_billing_webhook_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Requeue a failed webhook task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=max(0.0, delay_seconds),
    )


def decode_billing_webhook_task(task: QueuedTask) -> UUID:
    """Decode webhook_event_id from queued task."""
    if task.task_type != TASK_TYPE:
        raise ValueError(f"Unexpected task_type={task.task_type!r}")
    return UUID(task.payload["webhook_event_id"])

"""Queue payload helpers for welcome email delivery."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.services.queue import QueuedTask, enqueue_task
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "welcome_email_send"


@dataclass(frozen=True)
class QueuedWelcomeEmail:
    """Queued metadata for one welcome email send attempt."""

    user_email: str
    user_id: str
    first_name: str
    send_key: str
    trigger: str
    attempts: int = 0


def _task_from_payload(payload: QueuedWelcomeEmail) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "user_email": payload.user_email,
            "user_id": payload.user_id,
            "first_name": payload.first_name,
            "send_key": payload.send_key,
            "trigger": payload.trigger,
        },
        created_at=utcnow(),
        attempts=payload.attempts,
    )


def decode_welcome_email_task(task: QueuedTask) -> QueuedWelcomeEmail:
    if task.task_type != TASK_TYPE:
        raise ValueError(f"Unexpected task_type={task.task_type!r}; expected {TASK_TYPE!r}")

    payload: dict[str, Any] = task.payload
    send_key = str(payload.get("send_key") or "").strip() or uuid4().hex
    trigger = str(payload.get("trigger") or "unknown").strip().lower()

    return QueuedWelcomeEmail(
        user_email=str(payload["user_email"]),
        user_id=str(payload["user_id"]),
        first_name=str(payload.get("first_name") or ""),
        send_key=send_key,
        trigger=trigger,
        attempts=int(payload.get("attempts", task.attempts)),
    )


def enqueue_welcome_email_send(
    *,
    user_email: str,
    user_id: str,
    first_name: str,
    trigger: str,
) -> bool:
    payload = QueuedWelcomeEmail(
        user_email=user_email,
        user_id=user_id,
        first_name=first_name,
        send_key=uuid4().hex,
        trigger=trigger.strip().lower() or "unknown",
    )
    queued = _task_from_payload(payload)
    ok = enqueue_task(
        queued,
        settings.rq_queue_name,
        redis_url=settings.rq_redis_url,
    )
    if ok:
        logger.info(
            "email.welcome.queue.enqueued",
            extra={
                "user_id": user_id,
                "trigger": payload.trigger,
            },
        )
    return ok


def requeue_welcome_email_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Requeue a failed welcome-email task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=max(0.0, delay_seconds),
    )

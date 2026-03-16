"""Queue payload helpers for billing email delivery."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.services.queue import QueuedTask, enqueue_task
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "billing_email_send"


@dataclass(frozen=True)
class QueuedBillingEmail:
    """Queued metadata for one billing email send attempt."""

    organization_id: UUID
    email_type: str  # "upgrade_confirmed" | "trial_expiring" | "payment_failed"
    event_id: str
    send_key: str
    trigger: str
    attempts: int = 0


def _task_from_payload(payload: QueuedBillingEmail) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "organization_id": str(payload.organization_id),
            "email_type": payload.email_type,
            "event_id": payload.event_id,
            "send_key": payload.send_key,
            "trigger": payload.trigger,
        },
        created_at=utcnow(),
        attempts=payload.attempts,
    )


def decode_billing_email_task(task: QueuedTask) -> QueuedBillingEmail:
    if task.task_type != TASK_TYPE:
        raise ValueError(f"Unexpected task_type={task.task_type!r}; expected {TASK_TYPE!r}")

    payload: dict[str, Any] = task.payload
    send_key = str(payload.get("send_key") or "").strip() or uuid4().hex
    trigger = str(payload.get("trigger") or "webhook").strip().lower()

    return QueuedBillingEmail(
        organization_id=UUID(str(payload["organization_id"])),
        email_type=str(payload["email_type"]),
        event_id=str(payload.get("event_id") or ""),
        send_key=send_key,
        trigger=trigger,
        attempts=int(payload.get("attempts", task.attempts)),
    )


def enqueue_billing_email(
    *,
    organization_id: UUID,
    email_type: str,
    event_id: str,
    trigger: str = "webhook",
) -> bool:
    payload = QueuedBillingEmail(
        organization_id=organization_id,
        email_type=email_type,
        event_id=event_id,
        send_key=uuid4().hex,
        trigger=trigger.strip().lower() or "webhook",
    )
    queued = _task_from_payload(payload)
    ok = enqueue_task(
        queued,
        settings.rq_queue_name,
        redis_url=settings.rq_redis_url,
    )
    if ok:
        logger.info(
            "email.billing.queue.enqueued",
            extra={
                "organization_id": str(organization_id),
                "email_type": email_type,
                "trigger": payload.trigger,
            },
        )
    return ok


def requeue_billing_email_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Requeue a failed billing-email task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=max(0.0, delay_seconds),
    )

"""Queue payload helpers for organization invite email delivery."""

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
TASK_TYPE = "organization_invite_email_send"


@dataclass(frozen=True)
class QueuedOrganizationInviteEmail:
    """Queued metadata for one organization invite email send attempt."""

    invite_id: UUID
    send_key: str
    trigger: str
    attempts: int = 0


def _task_from_payload(payload: QueuedOrganizationInviteEmail) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "invite_id": str(payload.invite_id),
            "send_key": payload.send_key,
            "trigger": payload.trigger,
        },
        created_at=utcnow(),
        attempts=payload.attempts,
    )


def decode_invite_email_task(task: QueuedTask) -> QueuedOrganizationInviteEmail:
    if task.task_type not in {TASK_TYPE, "legacy"}:
        raise ValueError(f"Unexpected task_type={task.task_type!r}; expected {TASK_TYPE!r}")

    payload: dict[str, Any] = task.payload
    send_key = str(payload.get("send_key") or "").strip() or uuid4().hex
    trigger = str(payload.get("trigger") or "unknown").strip().lower()

    return QueuedOrganizationInviteEmail(
        invite_id=UUID(str(payload["invite_id"])),
        send_key=send_key,
        trigger=trigger,
        attempts=int(payload.get("attempts", task.attempts)),
    )


def enqueue_invite_email_send(*, invite_id: UUID, trigger: str) -> bool:
    payload = QueuedOrganizationInviteEmail(
        invite_id=invite_id,
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
            "email.invite.queue.enqueued",
            extra={
                "invite_id": str(invite_id),
                "trigger": payload.trigger,
            },
        )
    return ok


def requeue_invite_email_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Requeue a failed invite-email task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=max(0.0, delay_seconds),
    )

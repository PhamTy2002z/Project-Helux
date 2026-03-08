"""Queue payload helpers for asynchronous gateway activation/provisioning."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.services.queue import QueuedTask, enqueue_task
from app.services.queue import requeue_if_failed as generic_requeue_if_failed

logger = get_logger(__name__)
TASK_TYPE = "gateway_activation"


@dataclass(frozen=True)
class QueuedGatewayActivation:
    """Queued metadata for gateway activation/provisioning."""

    gateway_id: UUID
    action: str
    attempts: int = 0


def _task_from_payload(payload: QueuedGatewayActivation) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "gateway_id": str(payload.gateway_id),
            "action": payload.action,
        },
        created_at=utcnow(),
        attempts=payload.attempts,
    )


def decode_gateway_activation_task(task: QueuedTask) -> QueuedGatewayActivation:
    if task.task_type not in {TASK_TYPE, "legacy"}:
        raise ValueError(f"Unexpected task_type={task.task_type!r}; expected {TASK_TYPE!r}")
    payload: dict[str, Any] = task.payload
    action = str(payload.get("action") or "").strip().lower() or "provision"
    if action not in {"provision", "update"}:
        raise ValueError("action must be either 'provision' or 'update'")
    return QueuedGatewayActivation(
        gateway_id=UUID(str(payload["gateway_id"])),
        action=action,
        attempts=int(payload.get("attempts", task.attempts)),
    )


def enqueue_gateway_activation(payload: QueuedGatewayActivation) -> bool:
    queued = _task_from_payload(payload)
    ok = enqueue_task(
        queued,
        settings.rq_queue_name,
        redis_url=settings.rq_redis_url,
    )
    if ok:
        logger.info(
            "gateway.activation.queue.enqueued",
            extra={
                "gateway_id": str(payload.gateway_id),
                "action": payload.action,
                "attempt": payload.attempts,
            },
        )
    return ok


def requeue_gateway_activation_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Requeue a failed gateway activation task with capped retries."""
    return generic_requeue_if_failed(
        task,
        settings.rq_queue_name,
        max_retries=settings.rq_dispatch_max_retries,
        redis_url=settings.rq_redis_url,
        delay_seconds=max(0.0, delay_seconds),
    )

"""Worker handler for task review-SLA enforcement."""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.agents import Agent
from app.models.boards import Board
from app.models.tasks import Task
from app.services.activity_log import record_activity
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.queue import QueuedTask
from app.services.task_review_sla_queue import (
    decode_task_review_sla_deadline,
    enqueue_task_review_sla_deadline,
)

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)
_DEFAULT_RETRY_DELAY_SECONDS = 600.0


def _parse_backoff_schedule() -> list[float]:
    raw = settings.task_review_sla_retry_backoff_seconds
    values: list[float] = []
    for item in raw.split(","):
        normalized = item.strip()
        if not normalized:
            continue
        try:
            value = float(normalized)
        except ValueError:
            logger.warning(
                "task.review_sla.invalid_backoff_value",
                extra={"value": normalized},
            )
            continue
        if value >= 0:
            values.append(value)
    return values


def _next_delay_seconds(*, overdue_count: int) -> float:
    schedule = _parse_backoff_schedule()
    if not schedule:
        return _DEFAULT_RETRY_DELAY_SECONDS
    index = min(max(0, overdue_count - 1), len(schedule) - 1)
    return schedule[index]


async def _send_agent_message(
    *,
    session: AsyncSession,
    board: Board,
    agent: Agent | None,
    task_id: str,
    message: str,
) -> None:
    if agent is None or not agent.openclaw_session_id:
        return
    dispatch = GatewayDispatchService(session)
    config = await dispatch.optional_gateway_config_for_board(board)
    if config is None:
        return
    error = await dispatch.try_send_agent_message(
        session_key=agent.openclaw_session_id,
        config=config,
        agent_name=agent.name,
        message=message,
        deliver=True,
        organization_id=board.organization_id,
    )
    if error is not None:
        logger.warning(
            "task.review_sla.notify_failed",
            extra={
                "task_id": task_id,
                "agent_id": str(agent.id),
                "error": str(error),
            },
        )


def _review_overdue_message(*, board: Board, task: Task, overdue_count: int) -> str:
    due_text = task.review_due_at.isoformat() if task.review_due_at is not None else "unknown"
    return (
        "TASK REVIEW SLA MISSED\n"
        f"Board: {board.name}\n"
        f"Task: {task.title}\n"
        f"Task ID: {task.id}\n"
        f"Miss count: {overdue_count}\n"
        f"Previous due (UTC): {due_text}\n\n"
        "Take action: review now and move to done, or return to inbox with concrete change request."
    )


def _auto_reassign_message(*, board: Board, task: Task) -> str:
    return (
        "TASK REVIEW AUTO-REASSIGNED\n"
        f"Board: {board.name}\n"
        f"Task: {task.title}\n"
        f"Task ID: {task.id}\n\n"
        "Review SLA was exceeded repeatedly. Task returned to inbox for re-triage."
    )


async def process_task_review_sla_deadline_task(task: QueuedTask) -> None:
    """Enforce review SLA for one task and re-schedule follow-up checks."""
    task_id = decode_task_review_sla_deadline(task)
    now = utcnow()
    auto_reassign_after = max(1, settings.task_review_sla_auto_reassign_after)

    async with async_session_maker() as session:
        review_task = await Task.objects.by_id(task_id).first(session)
        if (
            review_task is None
            or review_task.board_id is None
            or review_task.status != "review"
            or review_task.review_due_at is None
        ):
            return

        if review_task.review_due_at > now:
            delay = (review_task.review_due_at - now).total_seconds()
            enqueue_task_review_sla_deadline(review_task.id, delay_seconds=max(0.0, delay))
            return

        board = await Board.objects.by_id(review_task.board_id).first(session)
        if board is None:
            return

        reviewer_id = review_task.reviewer_agent_id or review_task.assigned_agent_id
        reviewer = await Agent.objects.by_id(reviewer_id).first(session) if reviewer_id else None
        owner = (
            await Agent.objects.by_id(review_task.owner_agent_id).first(session)
            if review_task.owner_agent_id
            else None
        )
        overdue_count = int(review_task.review_overdue_count or 0) + 1

        if overdue_count >= auto_reassign_after:
            review_task.status = "inbox"
            review_task.assigned_agent_id = owner.id if owner is not None else None
            review_task.reviewer_agent_id = None
            review_task.review_entered_at = None
            review_task.review_due_at = None
            review_task.last_nudged_at = now
            review_task.review_overdue_count = overdue_count
            review_task.in_progress_at = None
            review_task.updated_at = now
            session.add(review_task)
            record_activity(
                session,
                event_type="task.status_changed",
                task_id=review_task.id,
                message=f"Task moved to inbox: review SLA exceeded for {review_task.title}.",
                board_id=board.id,
                organization_id=board.organization_id,
                agent_id=reviewer.id if reviewer is not None else None,
            )
            record_activity(
                session,
                event_type="task.review_sla_reassigned",
                task_id=review_task.id,
                message=f"Task auto-reassigned after {overdue_count} missed review SLA checks.",
                board_id=board.id,
                organization_id=board.organization_id,
                agent_id=reviewer.id if reviewer is not None else None,
            )
            await session.commit()
            await _send_agent_message(
                session=session,
                board=board,
                agent=owner,
                task_id=str(review_task.id),
                message=_auto_reassign_message(board=board, task=review_task),
            )
            return

        delay_seconds = _next_delay_seconds(overdue_count=overdue_count)
        review_task.review_overdue_count = overdue_count
        review_task.last_nudged_at = now
        review_task.review_due_at = now + timedelta(seconds=delay_seconds)
        review_task.updated_at = now
        session.add(review_task)
        record_activity(
            session,
            event_type="task.review_sla_overdue",
            task_id=review_task.id,
            message=(
                f"Task review SLA overdue (count={overdue_count}, "
                f"next_check_in_seconds={int(delay_seconds)})."
            ),
            board_id=board.id,
            organization_id=board.organization_id,
            agent_id=reviewer.id if reviewer is not None else None,
        )
        await session.commit()

        await _send_agent_message(
            session=session,
            board=board,
            agent=reviewer,
            task_id=str(review_task.id),
            message=_review_overdue_message(
                board=board,
                task=review_task,
                overdue_count=overdue_count,
            ),
        )
        enqueue_task_review_sla_deadline(review_task.id, delay_seconds=delay_seconds)

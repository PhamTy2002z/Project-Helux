"""Worker handler for file report deadline enforcement."""

from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.models.board_chat_file_tasks import BoardChatFileTask
from app.services.board_chat_files.report_deadline_queue import (
    decode_deadline_task,
    enqueue_report_deadline,
)
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.queue import QueuedTask

logger = get_logger(__name__)


def _parse_backoff_schedule() -> list[float]:
    """Parse comma-separated backoff seconds from config."""
    raw = settings.board_chat_file_report_retry_backoff_seconds
    return [float(s.strip()) for s in raw.split(",") if s.strip()]


async def process_report_deadline_task(task: QueuedTask) -> None:
    """Check if agent has reported; retry or mark timeout."""
    file_task_id = decode_deadline_task(task)

    async with async_session_maker() as session:
        file_task = await BoardChatFileTask.objects.by_id(file_task_id).first(session)
        if file_task is None:
            logger.warning(
                "report_deadline.task_not_found",
                extra={"file_task_id": str(file_task_id)},
            )
            return

        # Already reported — no-op
        if file_task.status == "reported":
            logger.info(
                "report_deadline.already_reported",
                extra={"file_task_id": str(file_task_id)},
            )
            return

        # Already terminal — no-op
        if file_task.status in ("failed", "timeout"):
            return

        max_retries = settings.board_chat_file_report_max_retries
        backoff = _parse_backoff_schedule()

        if file_task.retry_count < max_retries:
            # Send reminder and schedule next deadline check
            await _send_reminder(session, file_task)

            file_task.retry_count += 1
            file_task.updated_at = utcnow()
            session.add(file_task)
            await session.commit()

            # Schedule next check with backoff
            delay_idx = min(file_task.retry_count - 1, len(backoff) - 1)
            next_delay = backoff[delay_idx] if backoff else 120.0
            enqueue_report_deadline(file_task.id, delay_seconds=next_delay)

            logger.info(
                "report_deadline.retry_scheduled",
                extra={
                    "file_task_id": str(file_task_id),
                    "retry_count": file_task.retry_count,
                    "next_delay": next_delay,
                },
            )
        else:
            # Max retries exhausted — mark timeout
            file_task.status = "timeout"
            file_task.completed_at = utcnow()
            file_task.updated_at = utcnow()
            session.add(file_task)
            await session.commit()

            logger.warning(
                "report_deadline.timeout",
                extra={
                    "file_task_id": str(file_task_id),
                    "retry_count": file_task.retry_count,
                },
            )


async def _send_reminder(session, file_task: BoardChatFileTask) -> None:
    """Send a compact reminder message to the agent via gateway."""
    from app.models.agents import Agent
    from app.models.boards import Board

    asset = await BoardChatFileAsset.objects.by_id(file_task.file_asset_id).first(session)
    if asset is None:
        return

    agent = await Agent.objects.by_id(file_task.agent_id).first(session)
    if agent is None or not agent.openclaw_session_id:
        return

    board = await Board.objects.by_id(asset.board_id).first(session)
    if board is None:
        return

    dispatch = GatewayDispatchService(session)
    config = await dispatch.optional_gateway_config_for_board(board)
    if config is None:
        return

    message = (
        f"REMINDER: File report pending\n"
        f"File: {asset.file_name} (id: {asset.id})\n"
        f"Please reply with: [FILE_REPORT:{asset.id}] your analysis summary"
    )

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
            "report_deadline.reminder_failed",
            extra={
                "file_task_id": str(file_task.id),
                "agent_id": str(agent.id),
                "error": str(error),
            },
        )

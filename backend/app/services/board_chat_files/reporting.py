"""Process agent file reports: validate, persist, and update task status."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.board_chat_file_reports import BoardChatFileReport
from app.models.board_chat_file_tasks import BoardChatFileTask

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)

# Cap summary text to prevent abuse (4x preview max).
_MAX_SUMMARY_CHARS = settings.board_chat_file_preview_max_chars * 4


async def process_agent_file_report(
    *,
    session: AsyncSession,
    agent_id: UUID,
    file_asset_id: UUID,
    summary: str,
) -> bool:
    """Validate and persist an agent file report.

    Returns True if report accepted, False if rejected.
    Idempotent: updates existing report if agent re-submits.
    """
    # Find pending task for this agent + file
    task = await (
        BoardChatFileTask.objects
        .filter_by(file_asset_id=file_asset_id, agent_id=agent_id)
        .first(session)
    )
    if task is None:
        logger.warning(
            "file_report.no_task",
            extra={"agent_id": str(agent_id), "file_asset_id": str(file_asset_id)},
        )
        return False

    # Truncate summary
    truncated = summary[:_MAX_SUMMARY_CHARS] if len(summary) > _MAX_SUMMARY_CHARS else summary

    # Upsert report keyed by (file_asset_id, agent_id)
    existing = await (
        BoardChatFileReport.objects
        .filter_by(file_asset_id=file_asset_id, agent_id=agent_id)
        .first(session)
    )
    now = utcnow()
    if existing is not None:
        existing.summary = truncated
        existing.created_at = now
        session.add(existing)
    else:
        report = BoardChatFileReport(
            file_task_id=task.id,
            file_asset_id=file_asset_id,
            agent_id=agent_id,
            summary=truncated,
        )
        session.add(report)

    # Mark task as reported
    task.status = "reported"
    task.completed_at = now
    task.updated_at = now
    session.add(task)
    await session.flush()

    logger.info(
        "file_report.accepted",
        extra={
            "agent_id": str(agent_id),
            "file_asset_id": str(file_asset_id),
            "task_id": str(task.id),
        },
    )

    # Publish shared knowledge (Phase 5)
    from app.services.board_chat_files.shared_knowledge import publish_board_shared_summary

    await publish_board_shared_summary(
        session=session,
        file_asset_id=file_asset_id,
        agent_id=agent_id,
        summary=truncated,
    )

    return True

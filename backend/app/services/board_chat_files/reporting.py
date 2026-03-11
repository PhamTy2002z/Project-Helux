"""Process agent file reports: validate, persist, and update task status."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agents import Agent
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.models.board_chat_file_reports import BoardChatFileReport
from app.models.board_chat_file_tasks import BoardChatFileTask
from app.models.board_memory import BoardMemory
from app.models.boards import Board
from app.services.openclaw.gateway_dispatch import GatewayDispatchService

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)

# Cap summary text to prevent abuse (4x preview max).
_MAX_SUMMARY_CHARS = settings.board_chat_file_preview_max_chars * 4


@dataclass(frozen=True)
class _SignalContext:
    asset: BoardChatFileAsset
    reporter_name: str
    action: str
    summary_line: str


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
        report_action = "updated"
    else:
        report = BoardChatFileReport(
            file_task_id=task.id,
            file_asset_id=file_asset_id,
            agent_id=agent_id,
            summary=truncated,
        )
        session.add(report)
        report_action = "submitted"

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
    await publish_board_file_signal(
        session=session,
        file_asset_id=file_asset_id,
        agent_id=agent_id,
        summary=truncated,
        action=report_action,
    )

    return True


def _normalize_signal_summary(summary: str) -> str:
    """Keep board-wide signal text concise and single-line."""
    compact = " ".join(summary.strip().split())
    if not compact:
        return "(no summary provided)"
    max_chars = settings.board_chat_file_preview_max_chars
    if len(compact) <= max_chars:
        return compact
    return f"{compact[: max_chars - 3]}..."


async def publish_board_file_signal(
    *,
    session: AsyncSession,
    file_asset_id: UUID,
    agent_id: UUID,
    summary: str,
    action: str,
) -> None:
    """Broadcast a file-report update to board chat and active board agents."""
    try:
        context = await _build_signal_context(
            session=session,
            file_asset_id=file_asset_id,
            agent_id=agent_id,
            summary=summary,
            action=action,
        )
        if context is None:
            return
        await _create_board_chat_signal(session=session, context=context)
        await _notify_board_agents_signal(session=session, context=context, reporter_id=agent_id)
    except Exception:
        logger.exception(
            "file_signal.publish_failed",
            extra={
                "agent_id": str(agent_id),
                "file_asset_id": str(file_asset_id),
                "action": action,
            },
        )


async def _build_signal_context(
    *,
    session: AsyncSession,
    file_asset_id: UUID,
    agent_id: UUID,
    summary: str,
    action: str,
) -> _SignalContext | None:
    asset = await BoardChatFileAsset.objects.by_id(file_asset_id).first(session)
    if asset is None:
        return None
    reporter = await Agent.objects.by_id(agent_id).first(session)
    reporter_name = reporter.name.strip() if reporter and reporter.name else "Agent"
    return _SignalContext(
        asset=asset,
        reporter_name=reporter_name or "Agent",
        action=action,
        summary_line=_normalize_signal_summary(summary),
    )


async def _create_board_chat_signal(
    *,
    session: AsyncSession,
    context: _SignalContext,
) -> None:
    message = (
        f"[FILE_SIGNAL:{context.asset.id}] {context.reporter_name} {context.action} "
        f"file analysis for \"{context.asset.file_name}\".\n"
        f"Summary: {context.summary_line}"
    )
    session.add(
        BoardMemory(
            board_id=context.asset.board_id,
            content=message,
            tags=["chat", "file-signal"],
            is_chat=True,
            chat_session_id=context.asset.chat_session_id,
            source=context.reporter_name,
        ),
    )
    await session.flush()


async def _notify_board_agents_signal(
    *,
    session: AsyncSession,
    context: _SignalContext,
    reporter_id: UUID,
) -> None:
    board = await Board.objects.by_id(context.asset.board_id).first(session)
    if board is None:
        return
    recipients = await Agent.objects.filter_by(board_id=board.id).all(session)
    if not recipients:
        return

    dispatch = GatewayDispatchService(session)
    config = await dispatch.optional_gateway_config_for_board(board)
    if config is None:
        return

    signal = (
        "BOARD FILE SIGNAL\n"
        f"Reporter: {context.reporter_name}\n"
        f"Action: {context.action}\n"
        f"File: {context.asset.file_name} (id: {context.asset.id})\n"
        f"Summary: {context.summary_line}"
    )
    for recipient in recipients:
        if recipient.id == reporter_id or not recipient.openclaw_session_id:
            continue
        error = await dispatch.try_send_agent_message(
            session_key=recipient.openclaw_session_id,
            config=config,
            agent_name=recipient.name,
            message=signal,
            deliver=True,
            organization_id=board.organization_id,
        )
        if error is not None:
            logger.warning(
                "file_signal.notify_failed",
                extra={
                    "recipient_agent_id": str(recipient.id),
                    "file_asset_id": str(context.asset.id),
                    "error": str(error),
                },
            )

"""Publish file report summaries as board shared knowledge entries."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.models.board_memory import BoardMemory

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

logger = get_logger(__name__)


async def publish_board_shared_summary(
    *,
    session: AsyncSession,
    file_asset_id: UUID,
    agent_id: UUID,
    summary: str,
    board_id: UUID | None = None,
) -> bool:
    """Publish a report summary as board memory for shared knowledge.

    Uses deterministic dedupe tag to prevent duplicate entries on re-reports.
    Returns True if entry was created/updated, False if skipped.
    """
    if not summary.strip():
        return False

    # Resolve board_id from asset if not provided
    if board_id is None:
        asset = await BoardChatFileAsset.objects.by_id(file_asset_id).first(session)
        if asset is None:
            logger.warning(
                "shared_knowledge.asset_not_found",
                extra={"file_asset_id": str(file_asset_id)},
            )
            return False
        board_id = asset.board_id
    else:
        # board_id param might be the file_asset_id by mistake, resolve properly
        asset = await BoardChatFileAsset.objects.by_id(file_asset_id).first(session)
        if asset is not None:
            board_id = asset.board_id

    # Deterministic dedupe key
    dedupe_tag = f"file_report:{file_asset_id}:{agent_id}"

    # Check for existing entry with same dedupe tag (idempotent upsert)
    from sqlmodel import col

    existing = await (
        BoardMemory.objects.filter_by(board_id=board_id, is_chat=False)
        .filter(col(BoardMemory.tags).contains([dedupe_tag]))
        .first(session)
    )

    now = utcnow()
    content = f"File Report Summary\nFile: {file_asset_id}\nAgent: {agent_id}\n\n{summary}"
    tags = [
        "file_report",
        "shared_knowledge",
        f"file:{file_asset_id}",
        f"agent:{agent_id}",
        dedupe_tag,
    ]

    if existing is not None:
        existing.content = content
        existing.created_at = now
        session.add(existing)
        logger.info(
            "shared_knowledge.updated",
            extra={"dedupe_tag": dedupe_tag, "board_id": str(board_id)},
        )
    else:
        entry = BoardMemory(
            board_id=board_id,
            content=content,
            tags=tags,
            is_chat=False,
            source=f"file-report:{agent_id}",
        )
        session.add(entry)
        logger.info(
            "shared_knowledge.published",
            extra={"dedupe_tag": dedupe_tag, "board_id": str(board_id)},
        )

    await session.flush()
    return True

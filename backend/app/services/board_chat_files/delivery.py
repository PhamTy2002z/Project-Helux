"""File delivery contract: validate, link, and create task rows for chat files."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.models.board_chat_file_tasks import BoardChatFileTask
from app.models.board_chat_message_files import BoardChatMessageFile

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.models.agents import Agent
    from app.models.board_memory import BoardMemory

logger = get_logger(__name__)


async def validate_and_link_files(
    *,
    session: AsyncSession,
    board_id: UUID,
    memory: BoardMemory,
    file_ids: list[UUID],
) -> list[BoardChatFileAsset]:
    """Validate file ownership and persist message-file join rows.

    Returns the validated asset list for downstream delivery.
    Raises HTTPException if validation fails.
    """
    max_per_msg = settings.board_chat_file_max_per_message
    if len(file_ids) > max_per_msg:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {max_per_msg} files per message.",
        )

    # Deduplicate while preserving order
    seen: set[UUID] = set()
    unique_ids: list[UUID] = []
    for fid in file_ids:
        if fid not in seen:
            seen.add(fid)
            unique_ids.append(fid)

    assets: list[BoardChatFileAsset] = []
    for fid in unique_ids:
        asset = await BoardChatFileAsset.objects.by_id(fid).first(session)
        if asset is None or asset.board_id != board_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"File {fid} not found or does not belong to this board.",
            )
        assets.append(asset)

    # Persist message-file join rows
    for asset in assets:
        link = BoardChatMessageFile(
            board_memory_id=memory.id,
            file_asset_id=asset.id,
        )
        session.add(link)

    await session.flush()
    return assets


async def create_file_tasks_for_targets(
    *,
    session: AsyncSession,
    assets: list[BoardChatFileAsset],
    targets: dict[str, Agent],
) -> list[BoardChatFileTask]:
    """Create per-agent per-file task rows for mention targets."""
    tasks: list[BoardChatFileTask] = []
    now = utcnow()
    for asset in assets:
        for agent in targets.values():
            task = BoardChatFileTask(
                file_asset_id=asset.id,
                agent_id=agent.id,
                status="pending",
                dispatched_at=now,
                retry_count=0,
            )
            session.add(task)
            tasks.append(task)
    await session.flush()

    logger.info(
        "file_delivery.tasks_created",
        extra={
            "file_count": len(assets),
            "agent_count": len(targets),
            "task_count": len(tasks),
        },
    )
    return tasks

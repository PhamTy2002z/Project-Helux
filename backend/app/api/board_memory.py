"""Board memory CRUD and streaming endpoints."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlmodel import col
from sse_starlette.sse import EventSourceResponse

from app.api.deps import (
    ActorContext,
    get_board_for_actor_read,
    get_board_for_actor_write,
    require_admin_or_agent,
)
from app.core.config import settings
from app.core.time import utcnow
from app.db.pagination import paginate
from app.db.session import async_session_maker, get_session
from app.models.agents import Agent
from app.models.board_memory import BoardMemory
from app.schemas.board_memory import BoardMemoryCreate, BoardMemoryRead
from app.schemas.pagination import DefaultLimitOffsetPage
from app.services.board_chat_sessions import (
    get_chat_session_for_board,
    get_or_create_default_chat_session,
    maybe_auto_title_chat_session,
)
from app.services.board_chat_files.delivery import (
    create_file_tasks_for_targets,
    validate_and_link_files,
)
from app.services.board_chat_files.message_contract import build_file_manifest_block
from app.services.board_chat_files.report_deadline_queue import enqueue_report_deadline
from app.services.board_chat_files.report_parser import parse_file_reports
from app.services.board_chat_files.reporting import process_agent_file_report
from app.services.mentions import extract_mentions, matches_agent_mention
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.openclaw.gateway_rpc import GatewayConfig as GatewayClientConfig

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi_pagination.limit_offset import LimitOffsetPage
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.models.board_chat_sessions import BoardChatSession
    from app.models.boards import Board

router = APIRouter(prefix="/boards/{board_id}/memory", tags=["board-memory"])
MAX_SNIPPET_LENGTH = 800
STREAM_POLL_SECONDS = 2
IS_CHAT_QUERY = Query(default=None)
SINCE_QUERY = Query(default=None)
CHAT_SESSION_ID_QUERY = Query(default=None)
BOARD_READ_DEP = Depends(get_board_for_actor_read)
BOARD_WRITE_DEP = Depends(get_board_for_actor_write)
SESSION_DEP = Depends(get_session)
ACTOR_DEP = Depends(require_admin_or_agent)
_RUNTIME_TYPE_REFERENCES = (UUID,)


def _parse_since(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    normalized = normalized.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(UTC).replace(tzinfo=None)
    return parsed


def _actor_identifier(actor: ActorContext) -> str | None:
    if actor.actor_type == "agent" and actor.agent:
        return str(actor.agent.id)
    if actor.user:
        return str(actor.user.id)
    return None


async def _resolve_chat_session_for_read(
    *,
    session: AsyncSession,
    board: Board,
    actor: ActorContext,
    chat_session_id: UUID | None,
) -> BoardChatSession:
    if chat_session_id is not None:
        chat_session = await get_chat_session_for_board(
            session,
            board_id=board.id,
            chat_session_id=chat_session_id,
            include_archived=True,
        )
        if chat_session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        return chat_session
    return await get_or_create_default_chat_session(
        session,
        board_id=board.id,
        created_by=_actor_identifier(actor),
    )


async def _resolve_chat_session_for_write(
    *,
    session: AsyncSession,
    board: Board,
    actor: ActorContext,
    chat_session_id: UUID | None,
) -> BoardChatSession:
    if chat_session_id is not None:
        chat_session = await get_chat_session_for_board(
            session,
            board_id=board.id,
            chat_session_id=chat_session_id,
            include_archived=False,
        )
        if chat_session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        return chat_session
    return await get_or_create_default_chat_session(
        session,
        board_id=board.id,
        created_by=_actor_identifier(actor),
    )


def _serialize_memory(memory: BoardMemory) -> dict[str, object]:
    return BoardMemoryRead.model_validate(
        memory,
        from_attributes=True,
    ).model_dump(mode="json")


async def _fetch_memory_events(
    session: AsyncSession,
    board_id: UUID,
    since: datetime,
    is_chat: bool | None = None,
    chat_session_id: UUID | None = None,
) -> list[BoardMemory]:
    statement = (
        BoardMemory.objects.filter_by(board_id=board_id)
        # Old/invalid rows (empty/whitespace-only content) can exist; exclude them to
        # satisfy the NonEmptyStr response schema.
        .filter(func.length(func.trim(col(BoardMemory.content))) > 0)
    )
    if is_chat is not None:
        statement = statement.filter(col(BoardMemory.is_chat) == is_chat)
    if chat_session_id is not None:
        statement = statement.filter(col(BoardMemory.chat_session_id) == chat_session_id)
    statement = statement.filter(col(BoardMemory.created_at) >= since).order_by(
        col(BoardMemory.created_at),
    )
    return await statement.all(session)


async def _send_control_command(
    *,
    session: AsyncSession,
    board: Board,
    actor: ActorContext,
    dispatch: GatewayDispatchService,
    config: GatewayClientConfig,
    command: str,
) -> None:
    pause_targets: list[Agent] = await Agent.objects.filter_by(
        board_id=board.id,
    ).all(
        session,
    )
    for agent in pause_targets:
        if actor.actor_type == "agent" and actor.agent and agent.id == actor.agent.id:
            continue
        if not agent.openclaw_session_id:
            continue
        error = await dispatch.try_send_agent_message(
            session_key=agent.openclaw_session_id,
            config=config,
            agent_name=agent.name,
            message=command,
            deliver=True,
            organization_id=board.organization_id,
        )
        if error is not None:
            continue


def _chat_targets(
    *,
    agents: list[Agent],
    mentions: set[str],
    actor: ActorContext,
) -> dict[str, Agent]:
    targets: dict[str, Agent] = {}
    for agent in agents:
        if agent.is_board_lead:
            targets[str(agent.id)] = agent
            continue
        if mentions and matches_agent_mention(agent, mentions):
            targets[str(agent.id)] = agent
    if actor.actor_type == "agent" and actor.agent:
        targets.pop(str(actor.agent.id), None)
    return targets


def _actor_display_name(actor: ActorContext) -> str:
    if actor.actor_type == "agent" and actor.agent:
        return actor.agent.name
    if actor.user:
        return actor.user.preferred_name or actor.user.name or "User"
    return "User"


def _agent_reply_body_hint(memory: BoardMemory) -> str:
    payload = '{"content":"...","tags":["chat"]'
    if memory.chat_session_id is not None:
        payload += f',"chat_session_id":"{memory.chat_session_id}"'
    payload += "}"
    return payload


async def _notify_chat_targets(
    *,
    session: AsyncSession,
    board: Board,
    memory: BoardMemory,
    actor: ActorContext,
    file_assets: list | None = None,
) -> None:
    if not memory.content:
        return
    dispatch = GatewayDispatchService(session)
    config = await dispatch.optional_gateway_config_for_board(board)
    if config is None:
        return

    normalized = memory.content.strip()
    command = normalized.lower()
    # Special-case control commands to reach all board agents.
    # These are intended to be parsed verbatim by agent runtimes.
    if command in {"/pause", "/resume"}:
        await _send_control_command(
            session=session,
            board=board,
            actor=actor,
            dispatch=dispatch,
            config=config,
            command=command,
        )
        return

    mentions = extract_mentions(memory.content)
    targets = _chat_targets(
        agents=await Agent.objects.filter_by(board_id=board.id).all(session),
        mentions=mentions,
        actor=actor,
    )
    if not targets:
        return

    # Create per-agent per-file task rows and enqueue deadline checks
    if file_assets:
        file_tasks = await create_file_tasks_for_targets(
            session=session,
            assets=file_assets,
            targets=targets,
        )
        await session.commit()
        for ft in file_tasks:
            enqueue_report_deadline(ft.id)

    # Build file manifest block if files are attached
    file_block = ""
    if file_assets:
        file_block = build_file_manifest_block(
            board_id=board.id,
            assets=file_assets,
        )

    actor_name = _actor_display_name(actor)
    snippet = memory.content.strip()
    if len(snippet) > MAX_SNIPPET_LENGTH:
        snippet = f"{snippet[: MAX_SNIPPET_LENGTH - 3]}..."
    base_url = settings.base_url
    for agent in targets.values():
        if not agent.openclaw_session_id:
            continue
        mentioned = matches_agent_mention(agent, mentions)
        header = "BOARD CHAT MENTION" if mentioned else "BOARD CHAT"
        message = (
            f"{header}\n"
            f"Board: {board.name}\n"
            f"From: {actor_name}\n\n"
            f"{snippet}"
            f"{file_block}\n\n"
            "Reply via board chat:\n"
            f"POST {base_url}/api/v1/agent/boards/{board.id}/memory\n"
            f"Body: {_agent_reply_body_hint(memory)}"
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
            continue


@router.get("", response_model=DefaultLimitOffsetPage[BoardMemoryRead])
async def list_board_memory(
    *,
    is_chat: bool | None = IS_CHAT_QUERY,
    chat_session_id: UUID | None = CHAT_SESSION_ID_QUERY,
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> LimitOffsetPage[BoardMemoryRead]:
    """List board memory entries, optionally filtering chat entries."""
    resolved_chat_session_id: UUID | None = None
    if chat_session_id is not None and is_chat is not True:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chat_session_id requires is_chat=true",
        )
    if is_chat is True:
        chat_session = await _resolve_chat_session_for_read(
            session=session,
            board=board,
            actor=actor,
            chat_session_id=chat_session_id,
        )
        resolved_chat_session_id = chat_session.id

    statement = (
        BoardMemory.objects.filter_by(board_id=board.id)
        # Old/invalid rows (empty/whitespace-only content) can exist; exclude them to
        # satisfy the NonEmptyStr response schema.
        .filter(func.length(func.trim(col(BoardMemory.content))) > 0)
    )
    if is_chat is not None:
        statement = statement.filter(col(BoardMemory.is_chat) == is_chat)
    if resolved_chat_session_id is not None:
        statement = statement.filter(col(BoardMemory.chat_session_id) == resolved_chat_session_id)
    statement = statement.order_by(col(BoardMemory.created_at).desc())
    return await paginate(session, statement.statement)


@router.get("/stream")
async def stream_board_memory(
    request: Request,
    *,
    board: Board = BOARD_READ_DEP,
    actor: ActorContext = ACTOR_DEP,
    since: str | None = SINCE_QUERY,
    is_chat: bool | None = IS_CHAT_QUERY,
    chat_session_id: UUID | None = CHAT_SESSION_ID_QUERY,
) -> EventSourceResponse:
    """Stream board memory events over server-sent events."""
    if chat_session_id is not None and is_chat is not True:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chat_session_id requires is_chat=true",
        )
    resolved_chat_session_id: UUID | None = None
    if is_chat is True:
        async with async_session_maker() as bootstrap_session:
            chat_session = await _resolve_chat_session_for_read(
                session=bootstrap_session,
                board=board,
                actor=actor,
                chat_session_id=chat_session_id,
            )
        resolved_chat_session_id = chat_session.id
    since_dt = _parse_since(since) or utcnow()
    last_seen = since_dt

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        nonlocal last_seen
        while True:
            if await request.is_disconnected():
                break
            async with async_session_maker() as session:
                memories = await _fetch_memory_events(
                    session,
                    board.id,
                    last_seen,
                    is_chat=is_chat,
                    chat_session_id=resolved_chat_session_id,
                )
            for memory in memories:
                last_seen = max(memory.created_at, last_seen)
                payload = {"memory": _serialize_memory(memory)}
                yield {"event": "memory", "data": json.dumps(payload)}
            await asyncio.sleep(STREAM_POLL_SECONDS)

    return EventSourceResponse(event_generator(), ping=15)


@router.post("", response_model=BoardMemoryRead)
async def create_board_memory(
    payload: BoardMemoryCreate,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> BoardMemory:
    """Create a board memory entry and notify chat targets when needed."""
    is_chat = payload.tags is not None and "chat" in payload.tags
    if payload.chat_session_id is not None and not is_chat:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chat_session_id requires chat-tagged memory",
        )
    resolved_chat_session: BoardChatSession | None = None
    if is_chat:
        resolved_chat_session = await _resolve_chat_session_for_write(
            session=session,
            board=board,
            actor=actor,
            chat_session_id=payload.chat_session_id,
        )
    source = payload.source
    if is_chat and not source:
        if actor.actor_type == "agent" and actor.agent:
            source = actor.agent.name
        elif actor.user:
            source = actor.user.preferred_name or actor.user.name or "User"
    memory = BoardMemory(
        board_id=board.id,
        content=payload.content,
        tags=payload.tags,
        is_chat=is_chat,
        chat_session_id=resolved_chat_session.id if resolved_chat_session else None,
        source=source,
    )
    actor_agent = actor.agent if actor.actor_type == "agent" else None
    if actor_agent is not None:
        actor_agent.last_seen_at = utcnow()
        if actor_agent.status in {"offline", "provisioning"}:
            actor_agent.status = "online"
        actor_agent.updated_at = utcnow()
        session.add(actor_agent)
    session.add(memory)
    await session.commit()
    await session.refresh(memory)

    # Validate and link files if provided (Phase 3)
    file_assets = None
    if is_chat and payload.file_ids:
        file_assets = await validate_and_link_files(
            session=session,
            board_id=board.id,
            memory=memory,
            file_ids=payload.file_ids,
        )
        await session.commit()

    if is_chat:
        if resolved_chat_session is not None:
            await maybe_auto_title_chat_session(
                session,
                chat_session=resolved_chat_session,
                content=payload.content,
            )
        await _notify_chat_targets(
            session=session,
            board=board,
            memory=memory,
            actor=actor,
            file_assets=file_assets,
        )

    # Detect file reports from agent chat messages (Phase 4)
    if is_chat and actor.actor_type == "agent" and actor.agent:
        parsed_reports = parse_file_reports(payload.content)
        for pr in parsed_reports:
            try:
                await process_agent_file_report(
                    session=session,
                    agent_id=actor.agent.id,
                    file_asset_id=pr.file_asset_id,
                    summary=pr.summary,
                )
            except Exception:
                # Never fail the message create on report processing errors
                pass
        if parsed_reports:
            await session.commit()

    return memory

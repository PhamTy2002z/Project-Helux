"""Board chat-session CRUD endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import (
    ActorContext,
    get_board_for_actor_read,
    get_board_for_actor_write,
    require_admin_or_agent,
)
from app.core.time import utcnow
from app.db.session import get_session
from app.models.board_chat_sessions import BoardChatSession
from app.schemas.board_chat_sessions import (
    BoardChatSessionCreate,
    BoardChatSessionRead,
    BoardChatSessionUpdate,
)
from app.schemas.common import OkResponse
from app.services.board_chat_sessions import (
    DEFAULT_CHAT_SESSION_TITLE,
    get_chat_session_for_board,
    get_or_create_default_chat_session,
    list_chat_sessions_for_board,
    normalize_chat_session_title,
)

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.models.boards import Board

router = APIRouter(prefix="/boards/{board_id}/chat-sessions", tags=["board-chat-sessions"])
INCLUDE_ARCHIVED_QUERY = Query(default=False)
BOARD_READ_DEP = Depends(get_board_for_actor_read)
BOARD_WRITE_DEP = Depends(get_board_for_actor_write)
SESSION_DEP = Depends(get_session)
ACTOR_DEP = Depends(require_admin_or_agent)


def _actor_identifier(actor: ActorContext) -> str | None:
    if actor.actor_type == "agent" and actor.agent:
        return str(actor.agent.id)
    if actor.user:
        return str(actor.user.id)
    return None


async def _require_chat_session(
    *,
    session: AsyncSession,
    board: Board,
    chat_session_id: UUID,
    include_archived: bool,
) -> BoardChatSession:
    chat_session = await get_chat_session_for_board(
        session,
        board_id=board.id,
        chat_session_id=chat_session_id,
        include_archived=include_archived,
    )
    if chat_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return chat_session


@router.get("", response_model=list[BoardChatSessionRead])
async def list_board_chat_sessions(
    *,
    include_archived: bool = INCLUDE_ARCHIVED_QUERY,
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> list[BoardChatSessionRead]:
    """List board chat sessions in latest-updated order."""
    sessions = await list_chat_sessions_for_board(
        session,
        board_id=board.id,
        include_archived=include_archived,
    )
    if not sessions:
        default = await get_or_create_default_chat_session(
            session,
            board_id=board.id,
            created_by=_actor_identifier(actor),
        )
        sessions = [default]
    return [BoardChatSessionRead.model_validate(item, from_attributes=True) for item in sessions]


@router.post("", response_model=BoardChatSessionRead)
async def create_board_chat_session(
    payload: BoardChatSessionCreate,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> BoardChatSessionRead:
    """Create a new board chat session."""
    title = normalize_chat_session_title(payload.title or DEFAULT_CHAT_SESSION_TITLE)
    chat_session = BoardChatSession(
        board_id=board.id,
        title=title,
        created_by=_actor_identifier(actor),
    )
    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)
    return BoardChatSessionRead.model_validate(chat_session, from_attributes=True)


@router.patch("/{chat_session_id}", response_model=BoardChatSessionRead)
async def rename_board_chat_session(
    chat_session_id: UUID,
    payload: BoardChatSessionUpdate,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
) -> BoardChatSessionRead:
    """Rename an active board chat session."""
    chat_session = await _require_chat_session(
        session=session,
        board=board,
        chat_session_id=chat_session_id,
        include_archived=False,
    )
    chat_session.title = normalize_chat_session_title(payload.title)
    chat_session.updated_at = utcnow()
    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)
    return BoardChatSessionRead.model_validate(chat_session, from_attributes=True)


@router.delete("/{chat_session_id}", response_model=OkResponse)
async def archive_board_chat_session(
    chat_session_id: UUID,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
) -> OkResponse:
    """Archive (hide) a board chat session without deleting its messages."""
    chat_session = await _require_chat_session(
        session=session,
        board=board,
        chat_session_id=chat_session_id,
        include_archived=False,
    )
    archived_at = utcnow()
    chat_session.archived_at = archived_at
    chat_session.updated_at = archived_at
    session.add(chat_session)
    await session.commit()
    return OkResponse()

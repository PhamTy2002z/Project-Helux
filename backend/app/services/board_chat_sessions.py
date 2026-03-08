"""Utilities for board chat session lifecycle and title behavior."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING
from uuid import UUID

from sqlmodel import col

from app.core.time import utcnow
from app.models.board_chat_sessions import BoardChatSession

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

DEFAULT_CHAT_SESSION_TITLE = "New chat"
LEGACY_CHAT_SESSION_TITLE = "General"
AUTO_TITLE_MAX_LENGTH = 80
_MENTION_ONLY_PATTERN = re.compile(r"^(@[A-Za-z0-9_-]+\s*)+$")
_LEADING_MENTIONS_PATTERN = re.compile(r"^(@[A-Za-z0-9_-]+\s+)+")
_WHITESPACE_PATTERN = re.compile(r"\s+")


def normalize_chat_session_title(value: str) -> str:
    """Normalize a chat session title to a compact single-line string."""
    compact = _WHITESPACE_PATTERN.sub(" ", value).strip()
    if not compact:
        return DEFAULT_CHAT_SESSION_TITLE
    return compact[:120]


def is_meaningful_chat_message(content: str) -> bool:
    """Return whether chat content should trigger auto-title logic."""
    normalized = content.strip()
    if not normalized:
        return False
    if normalized.startswith("/"):
        return False
    if _MENTION_ONLY_PATTERN.fullmatch(normalized):
        return False
    return True


def derive_chat_session_title_from_message(content: str) -> str | None:
    """Build an automatic session title from the first meaningful user message."""
    if not is_meaningful_chat_message(content):
        return None
    normalized = _WHITESPACE_PATTERN.sub(" ", content).strip()
    normalized = _LEADING_MENTIONS_PATTERN.sub("", normalized).strip()
    if not normalized:
        return None
    if len(normalized) <= AUTO_TITLE_MAX_LENGTH:
        return normalized
    if AUTO_TITLE_MAX_LENGTH <= 3:
        return normalized[:AUTO_TITLE_MAX_LENGTH]
    return f"{normalized[: AUTO_TITLE_MAX_LENGTH - 3].rstrip()}..."


async def list_chat_sessions_for_board(
    session: AsyncSession,
    *,
    board_id: UUID,
    include_archived: bool = False,
) -> list[BoardChatSession]:
    """List chat sessions for a board, newest-updated first."""
    statement = BoardChatSession.objects.filter_by(board_id=board_id)
    if not include_archived:
        statement = statement.filter(col(BoardChatSession.archived_at).is_(None))
    statement = statement.order_by(
        col(BoardChatSession.updated_at).desc(),
        col(BoardChatSession.created_at).desc(),
    )
    return list(await statement.all(session))


async def get_chat_session_for_board(
    session: AsyncSession,
    *,
    board_id: UUID,
    chat_session_id: UUID,
    include_archived: bool = False,
) -> BoardChatSession | None:
    """Load a single chat session scoped to a board."""
    statement = BoardChatSession.objects.filter_by(id=chat_session_id, board_id=board_id)
    if not include_archived:
        statement = statement.filter(col(BoardChatSession.archived_at).is_(None))
    return await statement.first(session)


async def get_or_create_default_chat_session(
    session: AsyncSession,
    *,
    board_id: UUID,
    created_by: str | None,
) -> BoardChatSession:
    """Return an active default session, creating one if none is available."""
    existing = (
        await BoardChatSession.objects.filter_by(board_id=board_id)
        .filter(col(BoardChatSession.archived_at).is_(None))
        .order_by(col(BoardChatSession.created_at).asc())
        .first(session)
    )
    if existing is not None:
        return existing

    created = BoardChatSession(
        board_id=board_id,
        title=DEFAULT_CHAT_SESSION_TITLE,
        created_by=created_by,
    )
    session.add(created)
    await session.commit()
    await session.refresh(created)
    return created


async def maybe_auto_title_chat_session(
    session: AsyncSession,
    *,
    chat_session: BoardChatSession,
    content: str,
) -> BoardChatSession:
    """Auto-title untouched `New chat` sessions using first meaningful content."""
    if normalize_chat_session_title(chat_session.title) != DEFAULT_CHAT_SESSION_TITLE:
        return chat_session
    derived = derive_chat_session_title_from_message(content)
    if not derived:
        return chat_session
    chat_session.title = derived
    chat_session.updated_at = utcnow()
    session.add(chat_session)
    await session.commit()
    await session.refresh(chat_session)
    return chat_session

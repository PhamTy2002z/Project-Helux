"""Board chat session model for grouping board chat messages."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class BoardChatSession(QueryModel, table=True):
    """Logical chat thread for board chat messages."""

    __tablename__ = "board_chat_sessions"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)
    title: str = Field(default="New chat")
    created_by: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    archived_at: datetime | None = Field(default=None, index=True)

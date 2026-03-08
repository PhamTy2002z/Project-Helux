"""Schemas for board chat session CRUD endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

from app.schemas.common import NonEmptyStr

RUNTIME_ANNOTATION_TYPES = (datetime, UUID, NonEmptyStr)


class BoardChatSessionCreate(SQLModel):
    """Payload for creating a board chat session."""

    title: NonEmptyStr | None = None


class BoardChatSessionUpdate(SQLModel):
    """Payload for renaming a board chat session."""

    title: NonEmptyStr


class BoardChatSessionRead(SQLModel):
    """Serialized board chat session returned by API routes."""

    id: UUID
    board_id: UUID
    title: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None

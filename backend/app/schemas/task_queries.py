"""Schemas for scalable task query filters and cursor pagination."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import Field, SQLModel

from app.schemas.tasks import TaskRead

RUNTIME_ANNOTATION_TYPES = (datetime, UUID, TaskRead)


class TaskQueryFilters(SQLModel):
    """Optional filter set for board task list and cursor queries."""

    q: str | None = None
    tag_ids: list[UUID] = Field(default_factory=list)
    priority: list[str] = Field(default_factory=list)
    blocked: bool | None = None
    due_before: datetime | None = None
    due_after: datetime | None = None
    has_pending_approval: bool | None = None
    task_group_id: UUID | None = None
    archived: bool | None = None


class TaskCursorToken(SQLModel):
    """Decoded cursor payload for deterministic task pagination."""

    created_at: datetime
    task_id: UUID


class TaskCursorPage(SQLModel):
    """Cursor-based task page used by scalable board UI reads."""

    items: list[TaskRead] = Field(default_factory=list)
    next_cursor: str | None = None
    has_more: bool = False

"""Schemas for task-group planning overlay payloads."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

RUNTIME_ANNOTATION_TYPES = (datetime, UUID)


class TaskGroupBase(SQLModel):
    """Shared task-group fields used by create/read/update payloads."""

    title: str
    description: str | None = None
    rank: int = 0
    collapsed_default: bool = False


class TaskGroupCreate(TaskGroupBase):
    """Payload for creating a task group."""


class TaskGroupUpdate(SQLModel):
    """Payload for partial task-group updates."""

    title: str | None = None
    description: str | None = None
    rank: int | None = None
    collapsed_default: bool | None = None


class TaskGroupRead(TaskGroupBase):
    """Task-group payload returned from read endpoints."""

    id: UUID
    board_id: UUID
    created_at: datetime
    updated_at: datetime

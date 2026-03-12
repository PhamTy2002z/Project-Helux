"""Task-group planning overlay model for optional board hierarchy."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.tenancy import TenantScoped

RUNTIME_ANNOTATION_TYPES = (datetime,)


class TaskGroup(TenantScoped, table=True):
    """Optional planning container used to organize board tasks."""

    __tablename__ = "task_groups"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID | None = Field(default=None, foreign_key="organizations.id", index=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)

    title: str
    description: str | None = None
    rank: int = Field(default=0, index=True)
    collapsed_default: bool = Field(default=False)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

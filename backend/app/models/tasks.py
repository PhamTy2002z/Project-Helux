"""Task model representing board work items and execution metadata."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.task_groups import TaskGroup as _TaskGroup
from app.models.tenancy import TenantScoped

RUNTIME_ANNOTATION_TYPES = (datetime,)
MODEL_DEPENDENCIES = (_TaskGroup,)


class Task(TenantScoped, table=True):
    """Board-scoped task entity with ownership, status, and timing fields."""

    __tablename__ = "tasks"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID | None = Field(default=None, foreign_key="organizations.id", index=True)
    board_id: UUID | None = Field(default=None, foreign_key="boards.id", index=True)
    task_group_id: UUID | None = Field(default=None, foreign_key="task_groups.id", index=True)

    title: str
    description: str | None = None
    status: str = Field(default="inbox", index=True)
    priority: str = Field(default="medium", index=True)
    sort_index: int | None = Field(default=None, index=True)
    due_at: datetime | None = None
    archived_at: datetime | None = Field(default=None, index=True)
    in_progress_at: datetime | None = None
    previous_in_progress_at: datetime | None = None

    created_by_user_id: UUID | None = Field(
        default=None,
        foreign_key="users.id",
        index=True,
    )
    owner_agent_id: UUID | None = Field(
        default=None,
        foreign_key="agents.id",
        index=True,
    )
    reviewer_agent_id: UUID | None = Field(
        default=None,
        foreign_key="agents.id",
        index=True,
    )
    assigned_agent_id: UUID | None = Field(
        default=None,
        foreign_key="agents.id",
        index=True,
    )
    review_entered_at: datetime | None = Field(default=None, index=True)
    review_due_at: datetime | None = Field(default=None, index=True)
    review_overdue_count: int = Field(default=0)
    last_nudged_at: datetime | None = None
    auto_created: bool = Field(default=False)
    auto_reason: str | None = None

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

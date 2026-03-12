"""Per-agent per-file processing task tracking."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, UniqueConstraint

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)

# Valid status transitions: pending -> reported | failed | timeout
FILE_TASK_STATUSES = ("pending", "reported", "failed", "timeout")


class BoardChatFileTask(QueryModel, table=True):
    """Tracks per-agent processing state for a given file asset."""

    __tablename__ = "board_chat_file_tasks"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (UniqueConstraint("file_asset_id", "agent_id", name="uq_file_task_agent"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    file_asset_id: UUID = Field(foreign_key="board_chat_file_assets.id", index=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)

    status: str = Field(default="pending", max_length=20)
    dispatched_at: datetime | None = Field(default=None)
    ack_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)
    retry_count: int = Field(default=0)
    last_error: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

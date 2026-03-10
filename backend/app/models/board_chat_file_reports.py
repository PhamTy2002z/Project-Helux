"""Agent-generated reports for processed file assets."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class BoardChatFileReport(QueryModel, table=True):
    """Persisted agent report content for a file processing task."""

    __tablename__ = "board_chat_file_reports"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    file_task_id: UUID = Field(foreign_key="board_chat_file_tasks.id", index=True)
    file_asset_id: UUID = Field(foreign_key="board_chat_file_assets.id", index=True)
    agent_id: UUID = Field(foreign_key="agents.id", index=True)

    summary: str | None = Field(default=None)
    detail: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)

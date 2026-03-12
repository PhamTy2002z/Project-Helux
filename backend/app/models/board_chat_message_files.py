"""Junction table linking board_memory messages to file assets."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, UniqueConstraint

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)


class BoardChatMessageFile(QueryModel, table=True):
    """Many-to-many link between a chat message and its attached files."""

    __tablename__ = "board_chat_message_files"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (UniqueConstraint("board_memory_id", "file_asset_id", name="uq_message_file"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    board_memory_id: UUID = Field(foreign_key="board_memory.id", index=True)
    file_asset_id: UUID = Field(foreign_key="board_chat_file_assets.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)

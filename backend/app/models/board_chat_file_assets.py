"""Board chat file asset metadata for uploaded files."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel

RUNTIME_ANNOTATION_TYPES = (datetime,)

# Valid status transitions: uploaded -> extracting -> ready | failed
FILE_ASSET_STATUSES = ("uploaded", "extracting", "ready", "failed")


class BoardChatFileAsset(QueryModel, table=True):
    """Persisted metadata for a file uploaded in board chat."""

    __tablename__ = "board_chat_file_assets"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    board_id: UUID = Field(foreign_key="boards.id", index=True)
    chat_session_id: UUID = Field(foreign_key="board_chat_sessions.id", index=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)

    # File metadata
    file_name: str = Field(max_length=255)
    mime_type: str = Field(max_length=127)
    file_size_bytes: int
    sha256: str = Field(max_length=64)
    object_storage_key: str = Field(max_length=512)

    # Extraction state
    status: str = Field(default="uploaded", max_length=20)
    preview_text: str | None = Field(default=None)
    extraction_error: str | None = Field(default=None)

    uploaded_by: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

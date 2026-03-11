"""Schemas for board chat file upload and status API payloads."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class BoardChatFileUploadResponse(SQLModel):
    """Response after a successful file upload."""

    id: UUID
    board_id: UUID
    chat_session_id: UUID
    file_name: str
    mime_type: str
    file_size_bytes: int
    status: str
    preview_text: str | None = None
    created_at: datetime


class BoardChatFileRead(SQLModel):
    """Serialized file asset returned from read endpoints."""

    id: UUID
    board_id: UUID
    chat_session_id: UUID
    file_name: str
    mime_type: str
    file_size_bytes: int
    status: str
    preview_text: str | None = None
    extraction_error: str | None = None
    uploaded_by: str | None = None
    created_at: datetime
    updated_at: datetime


class BoardChatFileTaskRead(SQLModel):
    """Per-agent task status for a file."""

    id: UUID
    file_asset_id: UUID
    agent_id: UUID
    status: str
    dispatched_at: datetime | None = None
    completed_at: datetime | None = None
    retry_count: int = 0
    created_at: datetime


class BoardChatFileReportRead(SQLModel):
    """Agent report for a processed file."""

    id: UUID
    file_asset_id: UUID
    agent_id: UUID
    summary: str | None = None
    created_at: datetime


class BoardChatMessageAttachmentRead(SQLModel):
    """Lightweight file attachment metadata for chat message payloads."""

    id: UUID
    file_name: str
    mime_type: str
    file_size_bytes: int
    status: str
    preview_text: str | None = None


class AgentFileContentResponse(SQLModel):
    """Full extracted text response for agent consumption."""

    file_id: UUID
    filename: str
    mime_type: str
    extracted_text: str | None = None
    extract_status: str

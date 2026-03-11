"""Board chat file upload and status endpoints."""

from __future__ import annotations

import asyncio
import hashlib
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.api.deps import (
    ActorContext,
    get_board_for_actor_read,
    get_board_for_actor_write,
    require_admin_or_agent,
)
from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import get_session
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.models.board_chat_file_reports import BoardChatFileReport
from app.models.board_chat_file_tasks import BoardChatFileTask
from app.schemas.board_chat_files import (
    BoardChatFileRead,
    BoardChatFileReportRead,
    BoardChatFileTaskRead,
    BoardChatFileUploadResponse,
)
from sqlmodel import select

from app.services.board_chat_files.extractor import (
    extract_preview,
    extract_text,
    is_allowed_type,
    resolve_mime,
)
from app.services.board_chat_files.queue import enqueue_extraction
from app.services.board_chat_sessions import get_or_create_default_chat_session
from app.services.storage.minio_storage import get_object_storage

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.models.boards import Board

logger = get_logger(__name__)

router = APIRouter(
    prefix="/boards/{board_id}/chat-files",
    tags=["board-chat-files"],
)

BOARD_WRITE_DEP = Depends(get_board_for_actor_write)
BOARD_READ_DEP = Depends(get_board_for_actor_read)
SESSION_DEP = Depends(get_session)
ACTOR_DEP = Depends(require_admin_or_agent)

# Inline extraction threshold: files under this size are extracted synchronously.
_INLINE_EXTRACTION_THRESHOLD = 1_048_576  # 1 MB


def _actor_identifier(actor: ActorContext) -> str | None:
    if actor.actor_type == "agent" and actor.agent:
        return str(actor.agent.id)
    if actor.user:
        return str(actor.user.id)
    return None


def _build_object_key(board: Board, file_name: str) -> str:
    """Build a scoped object storage key to avoid collisions."""
    now = utcnow()
    date_prefix = now.strftime("%Y/%m/%d")
    ts = now.strftime("%H%M%S")
    safe_name = file_name.replace("/", "_").replace("\\", "_")
    return f"{board.organization_id}/{board.id}/{date_prefix}/{ts}-{safe_name}"


def _should_extract_inline(mime_type: str, file_size: int) -> bool:
    """Decide whether extraction should run in-request or via background queue.

    PDF parsing (especially OCR fallback for scans) can be expensive and block the UI.
    Keep PDFs async so upload requests return quickly, while small text-like files still
    get immediate previews.
    """
    if mime_type == "application/pdf":
        return False
    return file_size <= _INLINE_EXTRACTION_THRESHOLD


@router.post(
    "",
    response_model=BoardChatFileUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file to board chat",
    description="Upload a file for board chat. Supports txt, md, csv, json, pdf.",
)
async def upload_board_chat_file(
    file: UploadFile,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> BoardChatFileUploadResponse:
    """Accept a multipart file upload, store in MinIO, and extract preview text."""
    # Validate file name
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File name is required.",
        )

    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if not is_allowed_type(file.filename, content_type):
        allowed = settings.board_chat_file_allowed_types
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type. Allowed: {allowed}",
        )

    # Read file data and validate size
    data = await file.read()
    if len(data) > settings.board_chat_file_max_bytes:
        max_mb = settings.board_chat_file_max_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File exceeds maximum size of {max_mb:.0f} MB.",
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Empty files are not allowed.",
        )

    # Resolve MIME and compute hash
    mime_type = resolve_mime(file.filename, content_type)
    sha256 = hashlib.sha256(data).hexdigest()

    # Ensure a chat session exists
    chat_session = await get_or_create_default_chat_session(
        session,
        board_id=board.id,
        created_by=_actor_identifier(actor),
    )

    # Build storage key and upload to MinIO
    object_key = _build_object_key(board, file.filename)
    storage = get_object_storage()

    try:
        await asyncio.to_thread(storage.ensure_bucket)
        await asyncio.to_thread(storage.put_object, object_key, data, mime_type)
    except Exception as exc:
        logger.exception(
            "file_upload.storage_failed",
            extra={"board_id": str(board.id), "error": str(exc)},
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to store file. Please try again.",
        )

    # Create asset record
    asset = BoardChatFileAsset(
        board_id=board.id,
        chat_session_id=chat_session.id,
        organization_id=board.organization_id,
        file_name=file.filename,
        mime_type=mime_type,
        file_size_bytes=len(data),
        sha256=sha256,
        object_storage_key=object_key,
        status="uploaded",
        uploaded_by=_actor_identifier(actor),
    )
    session.add(asset)
    await session.commit()
    await session.refresh(asset)

    # Inline extraction for lightweight text-like files; queue heavy formats (PDF) asynchronously.
    if _should_extract_inline(mime_type, len(data)):
        try:
            full_text = extract_text(data, mime_type)
            asset.preview_text = extract_preview(full_text)
            asset.status = "ready"
        except Exception as exc:
            logger.warning(
                "file_upload.inline_extraction_failed",
                extra={"file_asset_id": str(asset.id), "error": str(exc)},
            )
            asset.status = "failed"
            asset.extraction_error = str(exc)[:500]
        asset.updated_at = utcnow()
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
    else:
        enqueue_extraction(asset.id)

    return BoardChatFileUploadResponse(
        id=asset.id,
        board_id=asset.board_id,
        chat_session_id=asset.chat_session_id,
        file_name=asset.file_name,
        mime_type=asset.mime_type,
        file_size_bytes=asset.file_size_bytes,
        status=asset.status,
        preview_text=asset.preview_text,
        created_at=asset.created_at,
    )


@router.get(
    "/{file_id}",
    response_model=BoardChatFileRead,
    summary="Get file asset status",
    description="Get the current status and metadata of an uploaded file.",
)
async def get_board_chat_file(
    file_id: UUID,
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> BoardChatFileRead:
    """Return the current status and metadata of an uploaded file asset."""
    asset = await BoardChatFileAsset.objects.by_id(file_id).first(session)
    if asset is None or asset.board_id != board.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return BoardChatFileRead.model_validate(asset, from_attributes=True)


@router.get(
    "",
    response_model=list[BoardChatFileRead],
    summary="List file assets for a board",
    description="List uploaded file assets for a board, with optional session and status filters.",
)
async def list_board_chat_files(
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
    chat_session_id: UUID | None = None,
    file_status: str | None = None,
) -> list[BoardChatFileRead]:
    """Return file assets scoped to this board, ordered newest first (max 100)."""
    stmt = (
        select(BoardChatFileAsset)
        .where(BoardChatFileAsset.board_id == board.id)
        .order_by(BoardChatFileAsset.created_at.desc())  # type: ignore[attr-defined]
        .limit(100)
    )
    if chat_session_id is not None:
        stmt = stmt.where(BoardChatFileAsset.chat_session_id == chat_session_id)
    if file_status is not None:
        stmt = stmt.where(BoardChatFileAsset.status == file_status)
    result = await session.exec(stmt)
    assets = result.all()
    return [BoardChatFileRead.model_validate(a, from_attributes=True) for a in assets]


@router.get(
    "/{file_id}/reports",
    response_model=list[BoardChatFileReportRead],
    summary="List agent reports for a file",
    description="Return all agent-generated reports for a given file asset.",
)
async def list_board_chat_file_reports(
    file_id: UUID,
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> list[BoardChatFileReportRead]:
    """Return reports associated with the file asset, validating board ownership."""
    asset = await BoardChatFileAsset.objects.by_id(file_id).first(session)
    if asset is None or asset.board_id != board.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    stmt = (
        select(BoardChatFileReport)
        .where(BoardChatFileReport.file_asset_id == file_id)
        .order_by(BoardChatFileReport.created_at.desc())  # type: ignore[attr-defined]
    )
    result = await session.exec(stmt)
    reports = result.all()
    return [BoardChatFileReportRead.model_validate(r, from_attributes=True) for r in reports]


@router.get(
    "/{file_id}/tasks",
    response_model=list[BoardChatFileTaskRead],
    summary="List agent tasks for a file",
    description="Return per-agent processing task records for a given file asset.",
)
async def list_board_chat_file_tasks(
    file_id: UUID,
    board: Board = BOARD_READ_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> list[BoardChatFileTaskRead]:
    """Return task records associated with the file asset, validating board ownership."""
    asset = await BoardChatFileAsset.objects.by_id(file_id).first(session)
    if asset is None or asset.board_id != board.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    stmt = (
        select(BoardChatFileTask)
        .where(BoardChatFileTask.file_asset_id == file_id)
        .order_by(BoardChatFileTask.created_at.desc())  # type: ignore[attr-defined]
    )
    result = await session.exec(stmt)
    tasks = result.all()
    return [BoardChatFileTaskRead.model_validate(t, from_attributes=True) for t in tasks]

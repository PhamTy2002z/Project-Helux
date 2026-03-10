"""Worker handler for async board chat file extraction tasks."""

from __future__ import annotations

from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.board_chat_file_assets import BoardChatFileAsset
from app.services.board_chat_files.extractor import extract_preview, extract_text
from app.services.board_chat_files.queue import decode_extraction_task
from app.services.queue import QueuedTask
from app.services.storage.minio_storage import get_object_storage

logger = get_logger(__name__)


async def process_extraction_task(task: QueuedTask) -> None:
    """Download file from object storage, extract text, and update asset row."""
    file_asset_id = decode_extraction_task(task)
    storage = get_object_storage()

    async with async_session_maker() as session:
        asset = await BoardChatFileAsset.objects.by_id(file_asset_id).first(session)
        if asset is None:
            logger.warning(
                "file_extract.asset_not_found",
                extra={"file_asset_id": str(file_asset_id)},
            )
            return

        if asset.status not in ("uploaded", "extracting"):
            logger.info(
                "file_extract.skip_terminal_status",
                extra={"file_asset_id": str(file_asset_id), "status": asset.status},
            )
            return

        asset.status = "extracting"
        asset.updated_at = utcnow()
        session.add(asset)
        await session.commit()

        try:
            data = storage.get_object(asset.object_storage_key)
            full_text = extract_text(data, asset.mime_type)
            asset.preview_text = extract_preview(full_text)
            asset.status = "ready"
            asset.extraction_error = None
        except Exception as exc:
            logger.exception(
                "file_extract.failed",
                extra={
                    "file_asset_id": str(file_asset_id),
                    "error": str(exc),
                },
            )
            asset.status = "failed"
            asset.extraction_error = str(exc)[:500]

        asset.updated_at = utcnow()
        session.add(asset)
        await session.commit()

    logger.info(
        "file_extract.complete",
        extra={
            "file_asset_id": str(file_asset_id),
            "status": asset.status,
        },
    )

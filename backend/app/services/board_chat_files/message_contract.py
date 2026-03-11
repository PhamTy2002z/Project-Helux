"""Build file-aware gateway message payloads for mentioned agents."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.core.config import settings

if TYPE_CHECKING:
    from app.models.board_chat_file_assets import BoardChatFileAsset


def build_file_manifest_block(
    *,
    board_id: UUID,
    assets: list[BoardChatFileAsset],
) -> str:
    """Build the file manifest + preview section appended to gateway messages.

    Includes:
    - Per-file metadata (name, mime, status)
    - Truncated preview blocks (capped at configured max chars)
    - Content-access URL for full text retrieval
    - Report instructions with structured tag format
    """
    if not assets:
        return ""

    base_url = settings.base_url
    max_preview = settings.board_chat_file_preview_max_chars
    lines: list[str] = ["\n---\nFILE MANIFEST"]

    for asset in assets:
        lines.append(
            f"- {asset.file_name} (id: {asset.id}, mime: {asset.mime_type}, "
            f"status: {asset.status})"
        )

    lines.append("")

    for asset in assets:
        preview = (asset.preview_text or "")[:max_preview]
        status_note = ""
        if asset.status != "ready":
            status_note = f" [extraction {asset.status}]"
        lines.append(
            f'<file name="{asset.file_name}" id="{asset.id}">{preview}{status_note}</file>'
        )
        lines.append(
            f"Full content: GET {base_url}/api/v1/agent/boards/{board_id}"
            f"/chat-files/{asset.id}/content"
        )

    lines.append("")
    lines.append("REPORT INSTRUCTIONS")
    for asset in assets:
        lines.append(f"Reply with: [FILE_REPORT:{asset.id}] your analysis summary")

    return "\n".join(lines)

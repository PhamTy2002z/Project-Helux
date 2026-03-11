"""Parse [FILE_REPORT:{uuid}] tags from agent chat message content."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import UUID

# Match [FILE_REPORT:{uuid}] followed by summary text (multi-line).
# Uses non-greedy match to handle multiple reports in one message.
_REPORT_PATTERN = re.compile(
    r"\[FILE_REPORT:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\s*"
    r"(.*?)(?=\[FILE_REPORT:|$)",
    re.DOTALL | re.IGNORECASE,
)

# Fast-path check to skip regex on non-file messages.
_TAG_PREFIX = "[FILE_REPORT"


@dataclass(frozen=True)
class ParsedFileReport:
    """Extracted file report from agent message content."""

    file_asset_id: UUID
    summary: str


def parse_file_reports(content: str) -> list[ParsedFileReport]:
    """Extract all FILE_REPORT blocks from message content.

    Returns empty list if no tags found (fast path for normal messages).
    Skips reports with empty summaries or malformed UUIDs.
    """
    if _TAG_PREFIX not in content:
        return []

    reports: list[ParsedFileReport] = []
    for match in _REPORT_PATTERN.finditer(content):
        raw_uuid = match.group(1)
        summary = match.group(2).strip()
        if not summary:
            continue
        try:
            file_asset_id = UUID(raw_uuid)
        except ValueError:
            continue
        reports.append(ParsedFileReport(file_asset_id=file_asset_id, summary=summary))

    return reports

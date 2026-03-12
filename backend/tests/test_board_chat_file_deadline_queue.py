# ruff: noqa: INP001
"""Phase 4 — unit tests for report deadline queue helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.services.board_chat_files.queue import TASK_TYPE as EXTRACT_TASK_TYPE
from app.services.board_chat_files.queue import decode_extraction_task
from app.services.board_chat_files.report_deadline_queue import (
    TASK_TYPE,
    decode_deadline_task,
)
from app.services.queue import QueuedTask


def test_decode_deadline_task_extracts_uuid() -> None:
    fid = uuid4()
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"file_task_id": str(fid)},
        created_at=datetime.now(UTC),
    )
    assert decode_deadline_task(task) == fid


def test_decode_deadline_task_invalid_uuid_raises() -> None:
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"file_task_id": "not-a-uuid"},
        created_at=datetime.now(UTC),
    )
    with pytest.raises(ValueError):
        decode_deadline_task(task)


def test_decode_deadline_task_missing_key_raises() -> None:
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={},
        created_at=datetime.now(UTC),
    )
    with pytest.raises(KeyError):
        decode_deadline_task(task)


# ---------------------------------------------------------------------------
# Extraction queue decode
# ---------------------------------------------------------------------------


def test_decode_extraction_task_extracts_uuid() -> None:
    fid = uuid4()
    task = QueuedTask(
        task_type=EXTRACT_TASK_TYPE,
        payload={"file_asset_id": str(fid)},
        created_at=datetime.now(UTC),
    )
    assert decode_extraction_task(task) == fid


def test_task_types_are_distinct() -> None:
    """Deadline and extraction task types must not collide."""
    assert TASK_TYPE != EXTRACT_TASK_TYPE
    assert TASK_TYPE == "board_chat_file_report_deadline"
    assert EXTRACT_TASK_TYPE == "board_chat_file_extract"

# ruff: noqa: INP001
"""Phase 3 — unit tests for file-aware gateway message contract builder."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

import pytest

from app.services.board_chat_files.message_contract import build_file_manifest_block


@dataclass
class _FakeAsset:
    """Lightweight stand-in for BoardChatFileAsset model."""

    id: UUID = field(default_factory=uuid4)
    file_name: str = "example.txt"
    mime_type: str = "text/plain"
    status: str = "ready"
    preview_text: str | None = "Hello world preview"


# ---------------------------------------------------------------------------
# Empty input
# ---------------------------------------------------------------------------


def test_empty_assets_returns_empty_string() -> None:
    assert build_file_manifest_block(board_id=uuid4(), assets=[]) == ""


# ---------------------------------------------------------------------------
# Single file — structure
# ---------------------------------------------------------------------------


def test_single_file_manifest_structure() -> None:
    bid = uuid4()
    asset = _FakeAsset(file_name="readme.md", mime_type="text/markdown")
    result = build_file_manifest_block(board_id=bid, assets=[asset])  # type: ignore[arg-type]

    assert "FILE MANIFEST" in result
    assert "readme.md" in result
    assert str(asset.id) in result
    assert "text/markdown" in result
    assert "status: ready" in result


def test_single_file_includes_preview() -> None:
    asset = _FakeAsset(preview_text="The preview content here")
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    assert "The preview content here" in result
    assert "<file" in result
    assert "</file>" in result


def test_single_file_includes_content_access_url() -> None:
    bid = uuid4()
    asset = _FakeAsset()
    result = build_file_manifest_block(board_id=bid, assets=[asset])  # type: ignore[arg-type]

    assert f"/agent/boards/{bid}/chat-files/{asset.id}/content" in result


def test_single_file_includes_report_instructions() -> None:
    asset = _FakeAsset()
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    assert "REPORT INSTRUCTIONS" in result
    assert f"[FILE_REPORT:{asset.id}]" in result


# ---------------------------------------------------------------------------
# Multiple files
# ---------------------------------------------------------------------------


def test_multiple_files_all_listed() -> None:
    assets = [
        _FakeAsset(file_name="a.txt"),
        _FakeAsset(file_name="b.csv"),
        _FakeAsset(file_name="c.json"),
    ]
    result = build_file_manifest_block(board_id=uuid4(), assets=assets)  # type: ignore[arg-type]

    assert "a.txt" in result
    assert "b.csv" in result
    assert "c.json" in result
    # Each file should have its own report instruction
    for asset in assets:
        assert f"[FILE_REPORT:{asset.id}]" in result


# ---------------------------------------------------------------------------
# Status markers
# ---------------------------------------------------------------------------


def test_extracting_status_shows_marker() -> None:
    asset = _FakeAsset(status="extracting", preview_text="partial text")
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    assert "[extraction extracting]" in result


def test_ready_status_no_marker() -> None:
    asset = _FakeAsset(status="ready", preview_text="done text")
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    assert "[extraction" not in result


# ---------------------------------------------------------------------------
# Preview truncation
# ---------------------------------------------------------------------------


def test_preview_respects_max_chars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.board_chat_files.message_contract.settings.board_chat_file_preview_max_chars",
        10,
    )
    asset = _FakeAsset(preview_text="A" * 100)
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    # The preview in the <file> block should be truncated
    # Count occurrences of 'A' in the file block
    file_block_start = result.index("<file")
    file_block_end = result.index("</file>")
    file_block = result[file_block_start:file_block_end]
    # Should have at most 10 A's in the preview area
    assert "A" * 11 not in file_block


def test_null_preview_treated_as_empty() -> None:
    asset = _FakeAsset(preview_text=None, status="extracting")
    result = build_file_manifest_block(board_id=uuid4(), assets=[asset])  # type: ignore[arg-type]

    # Should not crash, should show extraction status
    assert "[extraction extracting]" in result

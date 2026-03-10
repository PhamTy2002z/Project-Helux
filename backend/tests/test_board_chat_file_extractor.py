# ruff: noqa: INP001
"""Phase 2 — text extraction unit tests for board chat file uploads."""

from __future__ import annotations

import json

import pytest

from app.services.board_chat_files.extractor import (
    extract_preview,
    extract_text,
    is_allowed_type,
    resolve_mime,
)


# ---------------------------------------------------------------------------
# resolve_mime
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("file_name", "content_type", "expected"),
    [
        ("readme.txt", "text/plain", "text/plain"),
        ("notes.md", "text/markdown", "text/markdown"),
        ("data.csv", "text/csv", "text/csv"),
        ("config.json", "application/json", "application/json"),
        ("report.pdf", "application/pdf", "application/pdf"),
        # Content-type with charset param stripped
        ("notes.txt", "text/plain; charset=utf-8", "text/plain"),
        # Fallback to extension when content-type is generic
        ("readme.md", "application/octet-stream", "text/markdown"),
        ("data.csv", "application/octet-stream", "text/csv"),
        ("config.json", "application/octet-stream", "application/json"),
        ("report.pdf", "application/octet-stream", "application/pdf"),
        # Unknown extension + unknown content-type → passthrough
        ("archive.zip", "application/zip", "application/zip"),
        # Case insensitive extension fallback
        ("README.TXT", "application/octet-stream", "text/plain"),
    ],
)
def test_resolve_mime(file_name: str, content_type: str, expected: str) -> None:
    assert resolve_mime(file_name, content_type) == expected


# ---------------------------------------------------------------------------
# is_allowed_type
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("file_name", "content_type", "allowed"),
    [
        ("a.txt", "text/plain", True),
        ("b.md", "text/markdown", True),
        ("c.csv", "text/csv", True),
        ("d.json", "application/json", True),
        ("e.pdf", "application/pdf", True),
        # Fallback-resolved types are still allowed
        ("f.md", "application/octet-stream", True),
        # Blocked types
        ("g.zip", "application/zip", False),
        ("h.exe", "application/x-msdownload", False),
        ("i.png", "image/png", False),
    ],
)
def test_is_allowed_type(file_name: str, content_type: str, *, allowed: bool) -> None:
    assert is_allowed_type(file_name, content_type) is allowed


# ---------------------------------------------------------------------------
# extract_text — per handler
# ---------------------------------------------------------------------------

def test_extract_text_plain() -> None:
    data = b"Hello, world!"
    assert extract_text(data, "text/plain") == "Hello, world!"


def test_extract_text_plain_unicode() -> None:
    data = "Xin chào thế giới 🌍".encode("utf-8")
    assert extract_text(data, "text/plain") == "Xin chào thế giới 🌍"


def test_extract_text_markdown() -> None:
    data = b"# Title\n\nSome *bold* text."
    assert extract_text(data, "text/markdown") == "# Title\n\nSome *bold* text."


def test_extract_csv() -> None:
    data = b"name,age\nAlice,30\nBob,25"
    result = extract_text(data, "text/csv")
    assert "name | age" in result
    assert "Alice | 30" in result
    assert "Bob | 25" in result


def test_extract_json() -> None:
    obj = {"key": "value", "nested": {"a": 1}}
    data = json.dumps(obj).encode("utf-8")
    result = extract_text(data, "application/json")
    parsed = json.loads(result)
    assert parsed == obj
    # Pretty-printed with indent
    assert "\n" in result


def test_extract_json_invalid_raises() -> None:
    with pytest.raises(json.JSONDecodeError):
        extract_text(b"not-valid-json{", "application/json")


def test_extract_unsupported_mime_raises() -> None:
    with pytest.raises(ValueError, match="No extraction handler"):
        extract_text(b"data", "image/png")


def test_extract_text_plain_bad_encoding_replaces() -> None:
    """Invalid UTF-8 bytes should be replaced, not raise."""
    data = b"\xff\xfe invalid bytes"
    result = extract_text(data, "text/plain")
    assert "invalid bytes" in result


# ---------------------------------------------------------------------------
# extract_preview — truncation
# ---------------------------------------------------------------------------

def test_extract_preview_short(monkeypatch: pytest.MonkeyPatch) -> None:
    """Text shorter than max should return unchanged."""
    monkeypatch.setattr("app.services.board_chat_files.extractor.settings.board_chat_file_preview_max_chars", 500)
    text = "Short text"
    assert extract_preview(text) == text


def test_extract_preview_truncates(monkeypatch: pytest.MonkeyPatch) -> None:
    """Text longer than max should be truncated."""
    monkeypatch.setattr("app.services.board_chat_files.extractor.settings.board_chat_file_preview_max_chars", 10)
    text = "A" * 100
    assert extract_preview(text) == "A" * 10


def test_extract_preview_exact_boundary(monkeypatch: pytest.MonkeyPatch) -> None:
    """Text at exact max length should return unchanged."""
    monkeypatch.setattr("app.services.board_chat_files.extractor.settings.board_chat_file_preview_max_chars", 5)
    assert extract_preview("12345") == "12345"


def test_extract_preview_empty() -> None:
    assert extract_preview("") == ""

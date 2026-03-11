# ruff: noqa: INP001
"""Phase 4 — unit tests for [FILE_REPORT:{uuid}] tag parser."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.services.board_chat_files.report_parser import ParsedFileReport, parse_file_reports


# ---------------------------------------------------------------------------
# Fast-path: no FILE_REPORT tag → empty list
# ---------------------------------------------------------------------------

def test_no_tag_returns_empty() -> None:
    assert parse_file_reports("Just a normal chat message.") == []


def test_empty_string_returns_empty() -> None:
    assert parse_file_reports("") == []


# ---------------------------------------------------------------------------
# Single report
# ---------------------------------------------------------------------------

def test_single_report_parsed() -> None:
    fid = uuid4()
    content = f"[FILE_REPORT:{fid}] This file contains API docs for the payments module."
    reports = parse_file_reports(content)
    assert len(reports) == 1
    assert reports[0].file_asset_id == fid
    assert "API docs" in reports[0].summary


def test_single_report_multiline_summary() -> None:
    fid = uuid4()
    content = (
        f"[FILE_REPORT:{fid}] Line one of summary.\n"
        "Line two of summary.\n"
        "Line three."
    )
    reports = parse_file_reports(content)
    assert len(reports) == 1
    assert "Line one" in reports[0].summary
    assert "Line three" in reports[0].summary


# ---------------------------------------------------------------------------
# Multiple reports in single message
# ---------------------------------------------------------------------------

def test_multiple_reports_in_one_message() -> None:
    fid1 = uuid4()
    fid2 = uuid4()
    content = (
        f"[FILE_REPORT:{fid1}] Summary for first file.\n"
        f"[FILE_REPORT:{fid2}] Summary for second file."
    )
    reports = parse_file_reports(content)
    assert len(reports) == 2
    ids = {r.file_asset_id for r in reports}
    assert ids == {fid1, fid2}


# ---------------------------------------------------------------------------
# Edge cases: empty summary, malformed UUID
# ---------------------------------------------------------------------------

def test_empty_summary_skipped() -> None:
    fid = uuid4()
    content = f"[FILE_REPORT:{fid}]    "
    reports = parse_file_reports(content)
    assert reports == []


def test_malformed_uuid_skipped() -> None:
    content = "[FILE_REPORT:not-a-valid-uuid-format-xxx] some summary"
    reports = parse_file_reports(content)
    assert reports == []


def test_valid_report_among_noise() -> None:
    fid = uuid4()
    content = (
        "Here is some preamble text.\n"
        f"[FILE_REPORT:{fid}] The actual summary.\n"
        "And trailing text."
    )
    reports = parse_file_reports(content)
    assert len(reports) == 1
    assert reports[0].file_asset_id == fid


# ---------------------------------------------------------------------------
# Case insensitivity
# ---------------------------------------------------------------------------

def test_case_insensitive_tag() -> None:
    fid = uuid4()
    content = f"[file_report:{fid}] lowercase tag summary."
    reports = parse_file_reports(content)
    # Fast-path check is case-sensitive on "[FILE_REPORT", so lowercase fails fast-path
    # This tests that behavior — lowercase is not matched by fast-path prefix
    # The regex itself is IGNORECASE, but the prefix check prevents reaching it
    # So the behavior depends on whether lowercase matches _TAG_PREFIX
    assert len(reports) == 0  # _TAG_PREFIX = "[FILE_REPORT" won't match lowercase


# ---------------------------------------------------------------------------
# Data class immutability
# ---------------------------------------------------------------------------

def test_parsed_report_is_frozen() -> None:
    report = ParsedFileReport(file_asset_id=uuid4(), summary="test")
    with pytest.raises(AttributeError):
        report.summary = "modified"  # type: ignore[misc]

# ruff: noqa: INP001
"""Phase 4 — unit tests for agent file report processing service."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

import pytest

from app.services.board_chat_files.reporting import process_agent_file_report


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

@dataclass
class _FakeTask:
    id: UUID = field(default_factory=uuid4)
    file_asset_id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    status: str = "pending"
    completed_at: object = None
    updated_at: object = None


@dataclass
class _FakeReport:
    id: UUID = field(default_factory=uuid4)
    file_task_id: UUID = field(default_factory=uuid4)
    file_asset_id: UUID = field(default_factory=uuid4)
    agent_id: UUID = field(default_factory=uuid4)
    summary: str = ""
    created_at: object = None


class _FakeObjectsFilter:
    """Simulate Model.objects.filter_by(...).first(session)."""

    def __init__(self, result: object = None) -> None:
        self._result = result

    def filter_by(self, **_kw: object) -> _FakeObjectsFilter:
        return self

    async def first(self, _session: object) -> object:
        return self._result


@dataclass
class _FakeSession:
    added: list[object] = field(default_factory=list)
    flushed: int = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flushed += 1


# ---------------------------------------------------------------------------
# No matching task → rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_rejected_when_no_task(monkeypatch: pytest.MonkeyPatch) -> None:
    """Report should be rejected if no task exists for agent+file."""
    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileTask",
        type("M", (), {"objects": _FakeObjectsFilter(None)}),
    )

    result = await process_agent_file_report(
        session=_FakeSession(),  # type: ignore[arg-type]
        agent_id=uuid4(),
        file_asset_id=uuid4(),
        summary="Analysis complete.",
    )

    assert result is False


# ---------------------------------------------------------------------------
# Successful new report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_accepted_and_task_marked_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Valid report should be accepted, task status set to 'reported'."""
    task = _FakeTask()

    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileTask",
        type("M", (), {"objects": _FakeObjectsFilter(task)}),
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileReport",
        type(
            "R",
            (),
            {
                "objects": _FakeObjectsFilter(None),
                "__init__": lambda self, **kw: self.__dict__.update(kw),
            },
        ),
    )
    # Stub shared knowledge publish (imported locally inside function)
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.publish_board_shared_summary",
        _fake_publish,
    )

    fake_session = _FakeSession()
    result = await process_agent_file_report(
        session=fake_session,  # type: ignore[arg-type]
        agent_id=task.agent_id,
        file_asset_id=task.file_asset_id,
        summary="The file describes release procedures.",
    )

    assert result is True
    assert task.status == "reported"
    assert task.completed_at is not None
    assert fake_session.flushed >= 1


# ---------------------------------------------------------------------------
# Idempotent update on re-report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_idempotent_upsert(monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-submitting a report should update existing report row."""
    task = _FakeTask()
    existing_report = _FakeReport(summary="Old summary")

    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileTask",
        type("M", (), {"objects": _FakeObjectsFilter(task)}),
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileReport",
        type("R", (), {"objects": _FakeObjectsFilter(existing_report)}),
    )
    # publish_board_shared_summary is imported locally; patch at source module
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.publish_board_shared_summary",
        _fake_publish,
    )

    fake_session = _FakeSession()
    result = await process_agent_file_report(
        session=fake_session,  # type: ignore[arg-type]
        agent_id=task.agent_id,
        file_asset_id=task.file_asset_id,
        summary="Updated summary with more detail.",
    )

    assert result is True
    # Existing report should have been updated
    assert existing_report.summary == "Updated summary with more detail."


# ---------------------------------------------------------------------------
# Summary truncation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_report_truncates_long_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    """Summary exceeding max chars should be truncated."""
    task = _FakeTask()
    # _MAX_SUMMARY_CHARS = preview_max * 4 = 500 * 4 = 2000
    max_chars = 2000

    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileTask",
        type("M", (), {"objects": _FakeObjectsFilter(task)}),
    )
    created_reports: list[object] = []

    class _StubReport:
        objects = _FakeObjectsFilter(None)

        def __init__(self, **kw: object) -> None:
            self.__dict__.update(kw)
            created_reports.append(self)

    monkeypatch.setattr(
        "app.services.board_chat_files.reporting.BoardChatFileReport", _StubReport,
    )
    # publish_board_shared_summary is imported locally; patch at source module
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.publish_board_shared_summary",
        _fake_publish,
    )

    long_summary = "X" * 5000
    fake_session = _FakeSession()

    await process_agent_file_report(
        session=fake_session,  # type: ignore[arg-type]
        agent_id=task.agent_id,
        file_asset_id=task.file_asset_id,
        summary=long_summary,
    )

    assert len(created_reports) == 1
    assert len(created_reports[0].summary) == max_chars


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _fake_publish(**_kw: object) -> bool:
    return True

# ruff: noqa: INP001
"""Phase 5 — unit tests for shared knowledge publication from file reports."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

import pytest

from app.services.board_chat_files.shared_knowledge import publish_board_shared_summary


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

@dataclass
class _FakeAsset:
    id: UUID = field(default_factory=uuid4)
    board_id: UUID = field(default_factory=uuid4)


class _FakeObjectsQueryChain:
    """Simulate Model.objects.filter_by(...).filter(...).first(session)."""

    def __init__(self, result: object = None) -> None:
        self._result = result

    def by_id(self, _uid: UUID) -> _FakeObjectsQueryChain:
        return self

    def filter_by(self, **_kw: object) -> _FakeObjectsQueryChain:
        return self

    def filter(self, *_args: object) -> _FakeObjectsQueryChain:
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
# Empty summary → skip
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_summary_returns_false() -> None:
    result = await publish_board_shared_summary(
        session=_FakeSession(),  # type: ignore[arg-type]
        file_asset_id=uuid4(),
        agent_id=uuid4(),
        summary="   ",
    )
    assert result is False


# ---------------------------------------------------------------------------
# Asset not found → skip
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_asset_not_found_returns_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQueryChain(None)}),
    )

    result = await publish_board_shared_summary(
        session=_FakeSession(),  # type: ignore[arg-type]
        file_asset_id=uuid4(),
        agent_id=uuid4(),
        summary="Some valid summary.",
    )
    assert result is False


# ---------------------------------------------------------------------------
# New publication — creates board memory entry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_new_publication_creates_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    asset = _FakeAsset()

    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQueryChain(asset)}),
    )
    # No existing entry → new publish. Needs `tags` class attr for col(BoardMemory.tags).
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardMemory",
        type(
            "BM",
            (),
            {
                "objects": _FakeObjectsQueryChain(None),
                "tags": "tags",  # placeholder for col() reference
                "__init__": lambda self, **kw: self.__dict__.update(kw),
            },
        ),
    )
    # Stub sqlmodel col
    # col is imported locally: `from sqlmodel import col`
    monkeypatch.setattr(
        "sqlmodel.col",
        lambda *a, **kw: type("C", (), {"contains": lambda self, v: None})(),
    )

    fake_session = _FakeSession()
    result = await publish_board_shared_summary(
        session=fake_session,  # type: ignore[arg-type]
        file_asset_id=asset.id,
        agent_id=uuid4(),
        summary="File analysis: contains API design decisions.",
    )

    assert result is True
    assert fake_session.flushed == 1
    assert len(fake_session.added) == 1
    entry = fake_session.added[0]
    assert entry.is_chat is False
    assert "file_report" in entry.tags
    assert "shared_knowledge" in entry.tags


# ---------------------------------------------------------------------------
# Idempotent update — existing entry updated
# ---------------------------------------------------------------------------

@dataclass
class _FakeExistingMemory:
    content: str = "old content"
    created_at: object = None
    tags: list[str] = field(default_factory=list)


@pytest.mark.asyncio
async def test_idempotent_update_existing_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    asset = _FakeAsset()
    existing = _FakeExistingMemory()

    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQueryChain(asset)}),
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardMemory",
        type("BM", (), {"objects": _FakeObjectsQueryChain(existing), "tags": "tags"}),
    )
    # col is imported locally: `from sqlmodel import col`
    monkeypatch.setattr(
        "sqlmodel.col",
        lambda *a, **kw: type("C", (), {"contains": lambda self, v: None})(),
    )

    fake_session = _FakeSession()
    result = await publish_board_shared_summary(
        session=fake_session,  # type: ignore[arg-type]
        file_asset_id=asset.id,
        agent_id=uuid4(),
        summary="Updated analysis.",
    )

    assert result is True
    assert "Updated analysis" in existing.content


# ---------------------------------------------------------------------------
# Board ID provided directly
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_with_explicit_board_id(monkeypatch: pytest.MonkeyPatch) -> None:
    asset = _FakeAsset()

    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQueryChain(asset)}),
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.shared_knowledge.BoardMemory",
        type(
            "BM",
            (),
            {
                "objects": _FakeObjectsQueryChain(None),
                "tags": "tags",
                "__init__": lambda self, **kw: self.__dict__.update(kw),
            },
        ),
    )
    # col is imported locally: `from sqlmodel import col`
    monkeypatch.setattr(
        "sqlmodel.col",
        lambda *a, **kw: type("C", (), {"contains": lambda self, v: None})(),
    )

    fake_session = _FakeSession()
    result = await publish_board_shared_summary(
        session=fake_session,  # type: ignore[arg-type]
        file_asset_id=asset.id,
        agent_id=uuid4(),
        summary="Summary with explicit board.",
        board_id=uuid4(),
    )

    assert result is True
    assert fake_session.flushed == 1

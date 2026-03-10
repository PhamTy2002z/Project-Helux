# ruff: noqa: INP001
"""Phase 3 — unit tests for file delivery: validate, link, and task creation."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.board_chat_files.delivery import (
    create_file_tasks_for_targets,
    validate_and_link_files,
)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

@dataclass
class _FakeAsset:
    id: UUID = field(default_factory=uuid4)
    board_id: UUID = field(default_factory=uuid4)
    status: str = "ready"


@dataclass
class _FakeMemory:
    id: UUID = field(default_factory=uuid4)


@dataclass
class _FakeAgent:
    id: UUID = field(default_factory=uuid4)
    name: str = "Agent-1"


class _FakeObjectsQuery:
    """Simulate BoardChatFileAsset.objects.by_id(...).first(session)."""

    def __init__(self, assets: dict[UUID, _FakeAsset]) -> None:
        self._assets = assets
        self._target_id: UUID | None = None

    def by_id(self, uid: UUID) -> _FakeObjectsQuery:
        self._target_id = uid
        return self

    async def first(self, _session: object) -> _FakeAsset | None:
        if self._target_id is None:
            return None
        return self._assets.get(self._target_id)


@dataclass
class _FakeSession:
    added: list[object] = field(default_factory=list)
    flushed: int = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        self.flushed += 1


# ---------------------------------------------------------------------------
# validate_and_link_files
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_validate_and_link_rejects_too_many_files(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject when file_ids exceeds max_per_message."""
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.settings.board_chat_file_max_per_message", 3,
    )
    file_ids = [uuid4() for _ in range(4)]

    with pytest.raises(HTTPException) as exc_info:
        await validate_and_link_files(
            session=_FakeSession(),  # type: ignore[arg-type]
            board_id=uuid4(),
            memory=_FakeMemory(),  # type: ignore[arg-type]
            file_ids=file_ids,
        )
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_validate_and_link_rejects_unknown_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject file_id that doesn't exist in DB."""
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.settings.board_chat_file_max_per_message", 3,
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQuery({})}),
    )

    with pytest.raises(HTTPException) as exc_info:
        await validate_and_link_files(
            session=_FakeSession(),  # type: ignore[arg-type]
            board_id=uuid4(),
            memory=_FakeMemory(),  # type: ignore[arg-type]
            file_ids=[uuid4()],
        )
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_validate_and_link_rejects_wrong_board(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject file that belongs to a different board."""
    board_id = uuid4()
    other_board_id = uuid4()
    asset = _FakeAsset(board_id=other_board_id)

    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.settings.board_chat_file_max_per_message", 3,
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQuery({asset.id: asset})}),
    )

    with pytest.raises(HTTPException) as exc_info:
        await validate_and_link_files(
            session=_FakeSession(),  # type: ignore[arg-type]
            board_id=board_id,
            memory=_FakeMemory(),  # type: ignore[arg-type]
            file_ids=[asset.id],
        )
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_validate_and_link_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Valid files create join rows and return asset list."""
    board_id = uuid4()
    asset1 = _FakeAsset(board_id=board_id)
    asset2 = _FakeAsset(board_id=board_id)
    assets_db = {asset1.id: asset1, asset2.id: asset2}

    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.settings.board_chat_file_max_per_message", 3,
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQuery(assets_db)}),
    )
    # Stub BoardChatMessageFile to a simple class
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatMessageFile",
        type("Link", (), {"__init__": lambda self, **kw: self.__dict__.update(kw)}),
    )

    fake_session = _FakeSession()
    result = await validate_and_link_files(
        session=fake_session,  # type: ignore[arg-type]
        board_id=board_id,
        memory=_FakeMemory(),  # type: ignore[arg-type]
        file_ids=[asset1.id, asset2.id],
    )

    assert len(result) == 2
    # 2 link rows added
    assert len(fake_session.added) == 2
    assert fake_session.flushed == 1


@pytest.mark.asyncio
async def test_validate_and_link_deduplicates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Duplicate file_ids should be deduplicated."""
    board_id = uuid4()
    asset = _FakeAsset(board_id=board_id)

    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.settings.board_chat_file_max_per_message", 3,
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileAsset",
        type("M", (), {"objects": _FakeObjectsQuery({asset.id: asset})}),
    )
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatMessageFile",
        type("Link", (), {"__init__": lambda self, **kw: self.__dict__.update(kw)}),
    )

    fake_session = _FakeSession()
    result = await validate_and_link_files(
        session=fake_session,  # type: ignore[arg-type]
        board_id=board_id,
        memory=_FakeMemory(),  # type: ignore[arg-type]
        file_ids=[asset.id, asset.id, asset.id],
    )

    # Only 1 unique asset returned and 1 link row added
    assert len(result) == 1
    assert len(fake_session.added) == 1


# ---------------------------------------------------------------------------
# create_file_tasks_for_targets
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_file_tasks_creates_per_agent_per_file(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Should create N_files × N_agents task rows."""
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileTask",
        type("Task", (), {"__init__": lambda self, **kw: self.__dict__.update(kw)}),
    )

    assets = [_FakeAsset(), _FakeAsset()]
    agents = {"a1": _FakeAgent(name="Agent-1"), "a2": _FakeAgent(name="Agent-2")}
    fake_session = _FakeSession()

    tasks = await create_file_tasks_for_targets(
        session=fake_session,  # type: ignore[arg-type]
        assets=assets,  # type: ignore[arg-type]
        targets=agents,  # type: ignore[arg-type]
    )

    assert len(tasks) == 4  # 2 files × 2 agents
    assert fake_session.flushed == 1
    # All tasks should be pending
    for t in tasks:
        assert t.status == "pending"
        assert t.retry_count == 0


@pytest.mark.asyncio
async def test_create_file_tasks_empty_targets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No agents mentioned → zero task rows."""
    monkeypatch.setattr(
        "app.services.board_chat_files.delivery.BoardChatFileTask",
        type("Task", (), {"__init__": lambda self, **kw: self.__dict__.update(kw)}),
    )

    assets = [_FakeAsset()]
    fake_session = _FakeSession()

    tasks = await create_file_tasks_for_targets(
        session=fake_session,  # type: ignore[arg-type]
        assets=assets,  # type: ignore[arg-type]
        targets={},
    )

    assert tasks == []

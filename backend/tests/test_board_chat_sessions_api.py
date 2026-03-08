from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

import pytest

from app.api import board_chat_sessions as chat_sessions_api
from app.models.board_chat_sessions import BoardChatSession
from app.models.boards import Board
from app.schemas.board_chat_sessions import BoardChatSessionUpdate


@dataclass
class _FakeSession:
    added: list[object] = field(default_factory=list)
    commits: int = 0
    refreshed: int = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _value: object) -> None:
        self.refreshed += 1


def _board() -> Board:
    return Board(
        id=uuid4(),
        organization_id=uuid4(),
        name="Board A",
        slug="board-a",
        gateway_id=uuid4(),
    )


@pytest.mark.asyncio
async def test_archive_board_chat_session_marks_archived_timestamp(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board = _board()
    fake_session = _FakeSession()
    chat_session = BoardChatSession(board_id=board.id, title="Ops")

    async def _fake_require(**_kwargs: object) -> BoardChatSession:
        return chat_session

    monkeypatch.setattr(chat_sessions_api, "_require_chat_session", _fake_require)

    response = await chat_sessions_api.archive_board_chat_session(
        chat_session_id=chat_session.id,
        board=board,
        session=fake_session,  # type: ignore[arg-type]
    )

    assert response.ok is True
    assert chat_session.archived_at is not None
    assert chat_session.updated_at == chat_session.archived_at
    assert fake_session.commits == 1


@pytest.mark.asyncio
async def test_rename_board_chat_session_updates_title(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board = _board()
    fake_session = _FakeSession()
    chat_session = BoardChatSession(board_id=board.id, title="New chat")

    async def _fake_require(**_kwargs: object) -> BoardChatSession:
        return chat_session

    monkeypatch.setattr(chat_sessions_api, "_require_chat_session", _fake_require)

    renamed = await chat_sessions_api.rename_board_chat_session(
        chat_session_id=chat_session.id,
        payload=BoardChatSessionUpdate(title="Release prep"),
        board=board,
        session=fake_session,  # type: ignore[arg-type]
    )

    assert renamed.title == "Release prep"
    assert fake_session.commits == 1
    assert fake_session.refreshed == 1

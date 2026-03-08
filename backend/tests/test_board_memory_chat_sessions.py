from __future__ import annotations

from dataclasses import dataclass, field
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api import board_memory as board_memory_api
from app.api.deps import ActorContext
from app.models.board_chat_sessions import BoardChatSession
from app.models.boards import Board
from app.models.users import User
from app.schemas.board_memory import BoardMemoryCreate


@dataclass
class _FakeSession:
    added: list[object] = field(default_factory=list)
    commits: int = 0

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, _value: object) -> None:
        return None


def _board() -> Board:
    return Board(
        id=uuid4(),
        organization_id=uuid4(),
        name="Platform",
        slug="platform",
        gateway_id=uuid4(),
    )


def _user_actor() -> ActorContext:
    return ActorContext(
        actor_type="user",
        user=User(
            clerk_user_id="user_123",
            email="user@example.com",
            name="Operator",
            preferred_name="Operator",
        ),
    )


@pytest.mark.asyncio
async def test_create_board_memory_rejects_chat_session_without_chat_tag() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await board_memory_api.create_board_memory(
            BoardMemoryCreate(content="hello", chat_session_id=uuid4()),
            board=_board(),
            session=_FakeSession(),  # type: ignore[arg-type]
            actor=_user_actor(),
        )

    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_create_board_memory_assigns_chat_session_and_auto_titles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board = _board()
    actor = _user_actor()
    fake_session = _FakeSession()
    payload = BoardMemoryCreate(content="Ship release checklist", tags=["chat"])
    resolved_chat_session = BoardChatSession(
        board_id=board.id,
        title="New chat",
        created_by=str(actor.user.id) if actor.user else None,
    )
    called = {
        "resolve": 0,
        "auto_title": 0,
        "notify": 0,
    }

    async def _fake_resolve(**_kwargs: object) -> BoardChatSession:
        called["resolve"] += 1
        return resolved_chat_session

    async def _fake_auto_title(*_args: object, **_kwargs: object) -> BoardChatSession:
        called["auto_title"] += 1
        return resolved_chat_session

    async def _fake_notify(**_kwargs: object) -> None:
        called["notify"] += 1

    monkeypatch.setattr(
        board_memory_api,
        "_resolve_chat_session_for_write",
        _fake_resolve,
    )
    monkeypatch.setattr(
        board_memory_api,
        "maybe_auto_title_chat_session",
        _fake_auto_title,
    )
    monkeypatch.setattr(board_memory_api, "_notify_chat_targets", _fake_notify)

    created = await board_memory_api.create_board_memory(
        payload,
        board=board,
        session=fake_session,  # type: ignore[arg-type]
        actor=actor,
    )

    assert created.chat_session_id == resolved_chat_session.id
    assert called == {"resolve": 1, "auto_title": 1, "notify": 1}


@pytest.mark.asyncio
async def test_list_board_memory_rejects_chat_session_filter_without_is_chat() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await board_memory_api.list_board_memory(
            is_chat=None,
            chat_session_id=uuid4(),
            board=_board(),
            session=_FakeSession(),  # type: ignore[arg-type]
            actor=_user_actor(),
        )

    assert exc_info.value.status_code == 422

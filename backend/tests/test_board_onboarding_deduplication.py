# ruff: noqa: INP001, S101
"""Tests for board onboarding message deduplication safeguards."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from app.api import board_onboarding
from app.api.deps import ActorContext
from app.core.time import utcnow
from app.models.board_onboarding import BoardOnboardingSession
from app.schemas.board_onboarding import BoardOnboardingAgentQuestion, BoardOnboardingAnswer


@dataclass
class _FakeScalarResult:
    value: object | None

    def first(self) -> object | None:
        return self.value


@dataclass
class _FakeSession:
    first_value: object | None
    added: list[object] = field(default_factory=list)
    committed: int = 0
    refreshed: list[object] = field(default_factory=list)

    async def exec(self, _statement: object) -> _FakeScalarResult:
        return _FakeScalarResult(self.first_value)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


@pytest.mark.asyncio
async def test_answer_onboarding_deduplicates_consecutive_same_user_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    onboarding = BoardOnboardingSession(
        board_id=board_id,
        session_key="session-key",
        status="active",
        messages=[
            {
                "role": "user",
                "content": "NO",
                "timestamp": utcnow().isoformat(),
            },
        ],
    )
    session: Any = _FakeSession(first_value=onboarding)
    board = SimpleNamespace(id=board_id)
    dispatch_calls: list[str] = []

    class _FakeMessagingService:
        def __init__(self, _session: object) -> None:
            self._session = _session

        async def dispatch_answer(
            self,
            *,
            board: object,
            onboarding: object,
            answer_text: str,
            correlation_id: str,
        ) -> None:
            dispatch_calls.append(answer_text)

    monkeypatch.setattr(
        board_onboarding,
        "BoardOnboardingMessagingService",
        _FakeMessagingService,
    )

    result = await board_onboarding.answer_onboarding(
        payload=BoardOnboardingAnswer(answer="NO"),
        board=board,
        session=session,
    )

    assert result is onboarding
    assert dispatch_calls == []
    assert session.added == []
    assert session.committed == 0
    assert session.refreshed == []


@pytest.mark.asyncio
async def test_answer_onboarding_persists_user_message_before_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    onboarding = BoardOnboardingSession(
        board_id=board_id,
        session_key="session-key",
        status="active",
        messages=[
            {
                "role": "assistant",
                "content": '{"question":"Q1","options":[{"id":"1","label":"A"}]}',
                "timestamp": utcnow().isoformat(),
            },
        ],
    )
    session: Any = _FakeSession(first_value=onboarding)
    board = SimpleNamespace(id=board_id)
    commit_snapshots: list[int] = []

    class _FakeMessagingService:
        def __init__(self, _session: object) -> None:
            self._session = _session

        async def dispatch_answer(
            self,
            *,
            board: object,
            onboarding: object,
            answer_text: str,
            correlation_id: str,
        ) -> None:
            commit_snapshots.append(session.committed)

    monkeypatch.setattr(
        board_onboarding,
        "BoardOnboardingMessagingService",
        _FakeMessagingService,
    )

    result = await board_onboarding.answer_onboarding(
        payload=BoardOnboardingAnswer(answer="A"),
        board=board,
        session=session,
    )

    assert result is onboarding
    assert commit_snapshots == [1]
    assert session.committed == 1
    assert session.added == [onboarding]
    assert session.refreshed == [onboarding]
    assert (result.messages or [])[-1]["content"] == "A"


@pytest.mark.asyncio
async def test_agent_onboarding_update_deduplicates_same_question_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    payload = BoardOnboardingAgentQuestion(
        question="What timeline should we target?",
        options=[
            {"id": "1", "label": "30 days"},
            {"id": "2", "label": "60 days"},
        ],
    )
    payload_text = payload.model_dump_json(exclude_none=True)
    onboarding = BoardOnboardingSession(
        board_id=board_id,
        session_key="session-key",
        status="active",
        messages=[
            {
                "role": "assistant",
                "content": payload_text,
                "timestamp": utcnow().isoformat(),
            },
        ],
    )
    session: Any = _FakeSession(first_value=onboarding)
    board = SimpleNamespace(id=board_id)
    actor = ActorContext(
        actor_type="agent",
        agent=SimpleNamespace(id=uuid4(), board_id=board_id),
    )

    monkeypatch.setattr(
        board_onboarding.OpenClawAuthorizationPolicy,
        "require_gateway_scoped_actor",
        lambda **_kwargs: None,
    )

    async def _fake_get_gateway_for_board(
        _session: object,
        _board: object,
    ) -> None:
        return None

    monkeypatch.setattr(
        board_onboarding,
        "get_gateway_for_board",
        _fake_get_gateway_for_board,
    )

    result = await board_onboarding.agent_onboarding_update(
        payload=payload,
        board=board,
        session=session,
        actor=actor,
    )

    assert result is onboarding
    assert len(result.messages or []) == 1
    assert session.added == []
    assert session.committed == 0
    assert session.refreshed == []


@pytest.mark.asyncio
async def test_agent_onboarding_update_deduplicates_same_question_with_user_between(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    payload = BoardOnboardingAgentQuestion(
        question="What timeline should we target?",
        options=[
            {"id": "1", "label": "30 days"},
            {"id": "2", "label": "60 days"},
        ],
    )
    payload_text = payload.model_dump_json(exclude_none=True)
    onboarding = BoardOnboardingSession(
        board_id=board_id,
        session_key="session-key",
        status="active",
        messages=[
            {
                "role": "assistant",
                "content": payload_text,
                "timestamp": utcnow().isoformat(),
            },
            {
                "role": "user",
                "content": "60 days",
                "timestamp": utcnow().isoformat(),
            },
        ],
    )
    session: Any = _FakeSession(first_value=onboarding)
    board = SimpleNamespace(id=board_id)
    actor = ActorContext(
        actor_type="agent",
        agent=SimpleNamespace(id=uuid4(), board_id=board_id),
    )

    monkeypatch.setattr(
        board_onboarding.OpenClawAuthorizationPolicy,
        "require_gateway_scoped_actor",
        lambda **_kwargs: None,
    )

    async def _fake_get_gateway_for_board(
        _session: object,
        _board: object,
    ) -> None:
        return None

    monkeypatch.setattr(
        board_onboarding,
        "get_gateway_for_board",
        _fake_get_gateway_for_board,
    )

    result = await board_onboarding.agent_onboarding_update(
        payload=payload,
        board=board,
        session=session,
        actor=actor,
    )

    assert result is onboarding
    assert len(result.messages or []) == 2
    assert session.added == []
    assert session.committed == 0
    assert session.refreshed == []

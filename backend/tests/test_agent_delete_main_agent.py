# ruff: noqa: S101
"""Unit tests for protecting gateway main agents from mutations."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

import app.services.openclaw.provisioning_db as agent_service
from app.schemas.agents import AgentUpdate


@dataclass
class _FakeSession:
    committed: int = 0
    deleted: list[object] = field(default_factory=list)

    def add(self, _value: object) -> None:
        return None

    async def commit(self) -> None:
        self.committed += 1

    async def delete(self, value: object) -> None:
        self.deleted.append(value)


@dataclass
class _AgentStub:
    id: UUID
    name: str
    gateway_id: UUID
    organization_id: UUID
    board_id: UUID | None = None
    openclaw_session_id: str | None = None


@pytest.mark.asyncio
async def test_delete_gateway_main_agent_is_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()
    service = agent_service.AgentLifecycleService(session)  # type: ignore[arg-type]

    agent = _AgentStub(
        id=uuid4(),
        name="Primary Gateway Agent",
        gateway_id=uuid4(),
        organization_id=uuid4(),
        board_id=None,
        openclaw_session_id="agent:gateway-x:main",
    )
    ctx = SimpleNamespace(
        organization=SimpleNamespace(id=uuid4()),
        member=SimpleNamespace(id=uuid4()),
    )

    async def _fake_first_agent(_session: object) -> _AgentStub:
        return agent

    async def _no_access_check(*_args, **_kwargs) -> None:
        return None

    async def _should_not_delete(*_args, **_kwargs):
        raise AssertionError("_delete_agent_record should not run for protected agents")

    monkeypatch.setattr(
        agent_service.Agent,
        "objects",
        SimpleNamespace(by_id=lambda _id: SimpleNamespace(first=_fake_first_agent)),
    )
    monkeypatch.setattr(service, "require_agent_access", _no_access_check)
    monkeypatch.setattr(service, "_delete_agent_record", _should_not_delete)

    with pytest.raises(HTTPException) as exc_info:
        await service.delete_agent(agent_id=str(agent.id), ctx=ctx)  # type: ignore[arg-type]

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "system-managed" in str(exc_info.value.detail).lower()
    assert session.committed == 0
    assert session.deleted == []


@pytest.mark.asyncio
async def test_update_gateway_main_agent_is_forbidden(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()
    service = agent_service.AgentLifecycleService(session)  # type: ignore[arg-type]

    agent = _AgentStub(
        id=uuid4(),
        name="Primary Gateway Agent",
        gateway_id=uuid4(),
        organization_id=uuid4(),
        board_id=None,
        openclaw_session_id="agent:gateway-x:main",
    )
    ctx = SimpleNamespace(
        organization=SimpleNamespace(id=uuid4()),
        member=SimpleNamespace(id=uuid4()),
    )
    options = agent_service.AgentUpdateOptions(force=False, user=None, context=ctx)  # type: ignore[arg-type]

    async def _fake_first_agent(_session: object) -> _AgentStub:
        return agent

    async def _no_access_check(*_args, **_kwargs) -> None:
        return None

    async def _should_not_mutate(*_args, **_kwargs):
        raise AssertionError("Mutation internals should not run for protected agents")

    monkeypatch.setattr(
        agent_service.Agent,
        "objects",
        SimpleNamespace(by_id=lambda _id: SimpleNamespace(first=_fake_first_agent)),
    )
    monkeypatch.setattr(service, "require_agent_access", _no_access_check)
    monkeypatch.setattr(service, "validate_agent_update_inputs", _should_not_mutate)
    monkeypatch.setattr(service, "apply_agent_update_mutations", _should_not_mutate)

    with pytest.raises(HTTPException) as exc_info:
        await service.update_agent(
            agent_id=str(agent.id),
            payload=AgentUpdate(name="Updated Name"),
            options=options,
        )

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "system-managed" in str(exc_info.value.detail).lower()
    assert session.committed == 0

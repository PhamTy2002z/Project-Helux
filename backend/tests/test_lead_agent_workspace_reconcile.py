# ruff: noqa: S101
"""Unit tests for lead workspace reconcile in ensure_board_lead_agent."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

import app.services.openclaw.provisioning_db as agent_service
from app.services.openclaw.gateway_rpc import GatewayConfig as GatewayClientConfig
from app.services.openclaw.internal.session_keys import board_lead_session_key


@dataclass
class _ExecResult:
    value: object | None

    def first(self) -> object | None:
        return self.value


@dataclass
class _FakeSession:
    existing: object | None
    committed: int = 0
    added: list[object] = field(default_factory=list)
    refreshed: list[object] = field(default_factory=list)

    async def exec(self, *_args: object, **_kwargs: object) -> _ExecResult:
        return _ExecResult(self.existing)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)


@dataclass
class _LeadAgentStub:
    id: UUID
    name: str
    gateway_id: UUID
    openclaw_session_id: str
    agent_token_hash: str | None = None
    updated_at: object | None = None


def _lead_files(*, missing_memory: bool) -> dict[str, dict[str, object]]:
    files = {name: {"name": name, "missing": False} for name in agent_service.LEAD_GATEWAY_FILES}
    if missing_memory:
        files["MEMORY.md"] = {"name": "MEMORY.md", "missing": True}
    return files


@pytest.mark.asyncio
async def test_ensure_existing_lead_reconciles_when_memory_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    gateway_id = uuid4()
    existing = _LeadAgentStub(
        id=uuid4(),
        name="Lead Agent",
        gateway_id=gateway_id,
        openclaw_session_id=board_lead_session_key(board_id),
        agent_token_hash=None,
    )
    session = _FakeSession(existing=existing)
    service = agent_service.OpenClawProvisioningService(session)  # type: ignore[arg-type]
    board = SimpleNamespace(id=board_id)
    gateway = SimpleNamespace(id=gateway_id, url="ws://gateway.example/ws")

    observed: dict[str, object] = {}

    class _ControlPlaneStub:
        def __init__(self, _config: object) -> None:
            return None

        async def list_agent_files(self, agent_id: str) -> dict[str, dict[str, object]]:
            observed["agent_id"] = agent_id
            return _lead_files(missing_memory=True)

    async def _fake_get_existing_auth_token(
        *,
        agent_gateway_id: str,
        control_plane: object,
        backoff: object | None = None,
    ) -> str | None:
        _ = (agent_gateway_id, control_plane, backoff)
        return None

    def _fake_mint_agent_token(agent: _LeadAgentStub) -> str:
        agent.agent_token_hash = "rotated-hash"
        return "rotated-token"

    async def _fake_run_lifecycle(self, **kwargs: object) -> _LeadAgentStub:
        _ = self
        observed["lifecycle_kwargs"] = kwargs
        return existing

    monkeypatch.setattr(agent_service, "OpenClawGatewayControlPlane", _ControlPlaneStub)
    monkeypatch.setattr(agent_service, "_agent_key", lambda _agent: "lead-agent-id")
    monkeypatch.setattr(agent_service, "_get_existing_auth_token", _fake_get_existing_auth_token)
    monkeypatch.setattr(agent_service, "mint_agent_token", _fake_mint_agent_token)
    monkeypatch.setattr(
        agent_service.AgentLifecycleOrchestrator,
        "run_lifecycle",
        _fake_run_lifecycle,
    )

    lead, created = await service.ensure_board_lead_agent(
        request=agent_service.LeadAgentRequest(
            board=board,  # type: ignore[arg-type]
            gateway=gateway,  # type: ignore[arg-type]
            config=GatewayClientConfig(url="ws://gateway.example/ws", token=None),
            user=None,
            options=agent_service.LeadAgentOptions(action="provision"),
        ),
    )

    assert created is False
    assert lead is existing
    assert observed["agent_id"] == "lead-agent-id"
    lifecycle_kwargs = observed["lifecycle_kwargs"]
    assert isinstance(lifecycle_kwargs, dict)
    assert lifecycle_kwargs["action"] == "update"
    assert lifecycle_kwargs["wake"] is False
    assert lifecycle_kwargs["deliver_wakeup"] is False
    assert lifecycle_kwargs["auth_token"] == "rotated-token"
    assert session.committed == 1


@pytest.mark.asyncio
async def test_ensure_existing_lead_skips_reconcile_when_workspace_complete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    board_id = uuid4()
    gateway_id = uuid4()
    existing = _LeadAgentStub(
        id=uuid4(),
        name="Lead Agent",
        gateway_id=gateway_id,
        openclaw_session_id=board_lead_session_key(board_id),
        agent_token_hash="hashed-token",
    )
    session = _FakeSession(existing=existing)
    service = agent_service.OpenClawProvisioningService(session)  # type: ignore[arg-type]
    board = SimpleNamespace(id=board_id)
    gateway = SimpleNamespace(id=gateway_id, url="ws://gateway.example/ws")

    class _ControlPlaneStub:
        def __init__(self, _config: object) -> None:
            return None

        async def list_agent_files(self, _agent_id: str) -> dict[str, dict[str, object]]:
            return _lead_files(missing_memory=False)

    async def _should_not_run_lifecycle(self, **_kwargs: object) -> _LeadAgentStub:
        _ = self
        raise AssertionError("run_lifecycle should not be called when workspace is complete")

    monkeypatch.setattr(agent_service, "OpenClawGatewayControlPlane", _ControlPlaneStub)
    monkeypatch.setattr(agent_service, "_agent_key", lambda _agent: "lead-agent-id")
    monkeypatch.setattr(
        agent_service.AgentLifecycleOrchestrator,
        "run_lifecycle",
        _should_not_run_lifecycle,
    )

    lead, created = await service.ensure_board_lead_agent(
        request=agent_service.LeadAgentRequest(
            board=board,  # type: ignore[arg-type]
            gateway=gateway,  # type: ignore[arg-type]
            config=GatewayClientConfig(url="ws://gateway.example/ws", token=None),
            user=None,
            options=agent_service.LeadAgentOptions(action="provision"),
        ),
    )

    assert created is False
    assert lead is existing
    assert session.committed == 0

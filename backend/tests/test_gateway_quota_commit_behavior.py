# ruff: noqa: S101, PLR2004
"""Regression tests for quota-sync transaction persistence."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

import app.services.openclaw.gateway_dispatch as gateway_dispatch
import app.services.openclaw.session_service as session_service
from app.models.boards import Board
from app.schemas.gateway_api import GatewaySessionMessageRequest
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.openclaw.gateway_rpc import GatewayConfig
from app.services.openclaw.session_service import GatewaySessionService


class _FakeAsyncSession:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0
        self._in_transaction = True

    async def commit(self) -> None:
        self.commits += 1
        self._in_transaction = False

    async def rollback(self) -> None:
        self.rollbacks += 1
        self._in_transaction = False

    def in_transaction(self) -> bool:
        return self._in_transaction


class _FakeSessionContext:
    def __init__(self, session: _FakeAsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeAsyncSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        _ = (exc_type, exc, tb)
        return False


def _session_factory(session: _FakeAsyncSession):
    def _factory() -> _FakeSessionContext:
        return _FakeSessionContext(session)

    return _factory


@pytest.mark.asyncio
async def test_gateway_dispatch_commits_quota_sync_on_http_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = _FakeAsyncSession()

    class _QuotaService:
        def __init__(self, session: _FakeAsyncSession) -> None:
            self._session = session

        async def sync_and_enforce(self, **kwargs: object) -> None:
            _ = kwargs
            raise HTTPException(status_code=429, detail={"code": "quota_exceeded"})

    monkeypatch.setattr(gateway_dispatch, "async_session_maker", _session_factory(fake_session))
    monkeypatch.setattr(gateway_dispatch, "AgentTokenQuotaService", _QuotaService)

    with pytest.raises(HTTPException) as exc_info:
        await GatewayDispatchService._enforce_board_agent_quota(
            session_key="agent:mc-demo:main",
            organization_id=uuid4(),
            config=GatewayConfig(url="ws://gateway.example/ws"),
        )

    assert exc_info.value.status_code == 429
    assert fake_session.commits == 1
    assert fake_session.rollbacks == 0


@pytest.mark.asyncio
async def test_gateway_dispatch_rolls_back_on_non_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = _FakeAsyncSession()

    class _QuotaService:
        def __init__(self, session: _FakeAsyncSession) -> None:
            self._session = session

        async def sync_and_enforce(self, **kwargs: object) -> None:
            _ = kwargs
            raise RuntimeError("sync failed")

    monkeypatch.setattr(gateway_dispatch, "async_session_maker", _session_factory(fake_session))
    monkeypatch.setattr(gateway_dispatch, "AgentTokenQuotaService", _QuotaService)

    with pytest.raises(RuntimeError):
        await GatewayDispatchService._enforce_board_agent_quota(
            session_key="agent:mc-demo:main",
            organization_id=uuid4(),
            config=GatewayConfig(url="ws://gateway.example/ws"),
        )

    assert fake_session.commits == 0
    assert fake_session.rollbacks == 1


@pytest.mark.asyncio
async def test_gateway_session_message_persists_sync_before_sending(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = _FakeAsyncSession()
    service = GatewaySessionService(session=fake_session)  # type: ignore[arg-type]
    org_id = uuid4()
    board = Board(id=uuid4(), organization_id=org_id, gateway_id=uuid4(), name="B", slug="b")

    async def _fake_require_gateway(self, board_id: str | None, user=None):
        _ = (self, board_id, user)
        return board, GatewayConfig(url="ws://gateway.example/ws"), None

    async def _fake_require_board_access(*args, **kwargs) -> None:
        _ = (args, kwargs)

    class _QuotaService:
        def __init__(self, session: _FakeAsyncSession) -> None:
            self._session = session

        async def sync_and_enforce(self, **kwargs: object) -> None:
            _ = kwargs
            return None

    send_called = {"value": False}

    async def _fake_send_message(*args, **kwargs) -> None:
        _ = (args, kwargs)
        send_called["value"] = True

    monkeypatch.setattr(GatewaySessionService, "require_gateway", _fake_require_gateway)
    monkeypatch.setattr(session_service, "require_board_access", _fake_require_board_access)
    monkeypatch.setattr(session_service, "AgentTokenQuotaService", _QuotaService)
    monkeypatch.setattr(session_service, "send_message", _fake_send_message)

    await service.send_session_message(
        session_id="agent:mc-demo:main",
        payload=GatewaySessionMessageRequest(content="hello"),
        board_id=str(board.id),
        organization_id=org_id,
        user=SimpleNamespace(id=uuid4()),
    )

    assert fake_session.commits == 1
    assert send_called["value"] is True


@pytest.mark.asyncio
async def test_gateway_session_message_commits_before_quota_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_session = _FakeAsyncSession()
    service = GatewaySessionService(session=fake_session)  # type: ignore[arg-type]
    org_id = uuid4()
    board = Board(id=uuid4(), organization_id=org_id, gateway_id=uuid4(), name="B", slug="b")

    async def _fake_require_gateway(self, board_id: str | None, user=None):
        _ = (self, board_id, user)
        return board, GatewayConfig(url="ws://gateway.example/ws"), None

    async def _fake_require_board_access(*args, **kwargs) -> None:
        _ = (args, kwargs)

    class _QuotaService:
        def __init__(self, session: _FakeAsyncSession) -> None:
            self._session = session

        async def sync_and_enforce(self, **kwargs: object) -> None:
            _ = kwargs
            raise HTTPException(status_code=429, detail={"code": "quota_exceeded"})

    monkeypatch.setattr(GatewaySessionService, "require_gateway", _fake_require_gateway)
    monkeypatch.setattr(session_service, "require_board_access", _fake_require_board_access)
    monkeypatch.setattr(session_service, "AgentTokenQuotaService", _QuotaService)

    with pytest.raises(HTTPException) as exc_info:
        await service.send_session_message(
            session_id="agent:mc-demo:main",
            payload=GatewaySessionMessageRequest(content="hello"),
            board_id=str(board.id),
            organization_id=org_id,
            user=SimpleNamespace(id=uuid4()),
        )

    assert exc_info.value.status_code == 429
    assert fake_session.commits == 1

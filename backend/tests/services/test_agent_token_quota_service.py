# ruff: noqa: INP001,S101
"""Agent token quota sync/enforcement tests."""

from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import app.services.agent_token_quota_service as quota_service_module
from app.core.config import settings
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.services.agent_token_quota_service import AgentTokenQuotaService
from app.services.entitlements import policy_for_tier
from app.services.openclaw.gateway_rpc import GatewayConfig
from app.services.openclaw.session_usage_sync import SessionUsageSyncResult
from app.services.openclaw.usage_capability import GatewayUsageCapabilityResult


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


@pytest.mark.asyncio
async def test_sync_and_enforce_skips_unsupported_gateways_in_observe_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "observe")

            async def _fake_capability(_config: GatewayConfig) -> GatewayUsageCapabilityResult:
                return GatewayUsageCapabilityResult(
                    supported=False,
                    code="sessions_usage_unsupported",
                    message="unsupported",
                )

            monkeypatch.setattr(
                quota_service_module,
                "check_gateway_sessions_usage_capability",
                _fake_capability,
            )

            service = AgentTokenQuotaService(session)
            result = await service.sync_and_enforce(
                session_key="agent:missing:main",
                organization_id=uuid4(),
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )

            assert result is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_blocks_when_gateway_usage_is_unsupported_in_enforce_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "enforce")
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="ws://gateway.example/ws",
                workspace_root="/workspace",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
            )
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Worker",
                openclaw_session_id="agent:mc-demo:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            await session.commit()

            async def _fake_capability(_config: GatewayConfig) -> GatewayUsageCapabilityResult:
                return GatewayUsageCapabilityResult(
                    supported=False,
                    code="sessions_usage_unsupported",
                    message="unsupported",
                )

            async def _fake_resolve_agent(
                self: object,
                *,
                session_key: str,
                organization_id: object | None = None,
            ) -> Agent | None:
                _ = (self, session_key, organization_id)
                return agent

            monkeypatch.setattr(
                quota_service_module,
                "check_gateway_sessions_usage_capability",
                _fake_capability,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "resolve_board_scoped_agent",
                _fake_resolve_agent,
            )

            service = AgentTokenQuotaService(session)
            with pytest.raises(HTTPException) as exc_info:
                await service.sync_and_enforce(
                    session_key=agent.openclaw_session_id or "",
                    organization_id=org.id,
                    config=GatewayConfig(url="ws://gateway.example/ws"),
                )
            assert exc_info.value.status_code == 503
            assert isinstance(exc_info.value.detail, dict)
            assert exc_info.value.detail.get("code") == "sessions_usage_unsupported"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_raises_429_and_marks_blocked_at_when_quota_reached(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "enforce")
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="ws://gateway.example/ws",
                workspace_root="/workspace",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
            )
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Worker",
                openclaw_session_id="agent:mc-demo:main",
            )
            usage_date_vn = date(2026, 3, 9)
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent.id,
                    usage_date_vn=usage_date_vn,
                    openclaw_tokens_total=40_000,
                    billed_tokens_used=20_000,
                ),
            )
            await session.commit()

            async def _fake_capability(_config: GatewayConfig) -> GatewayUsageCapabilityResult:
                return GatewayUsageCapabilityResult(
                    supported=True,
                    code="supported",
                    message=None,
                )

            async def _fake_resolve_agent(
                self: object,
                *,
                session_key: str,
                organization_id: object | None = None,
            ) -> Agent | None:
                _ = (self, session_key, organization_id)
                return agent

            async def _fake_sync_session_usage(
                self: object,
                *,
                agent: Agent,
                config: GatewayConfig,
                usage_date_vn: date | None = None,
            ) -> SessionUsageSyncResult:
                _ = (self, agent, config, usage_date_vn)
                return SessionUsageSyncResult(
                    agent_id=str(agent.id),
                    organization_id=str(org.id),
                    usage_date_vn=usage_date_vn or date(2026, 3, 9),
                    openclaw_total=40_000,
                    openclaw_delta=0,
                    billed_delta=0,
                    billed_total=20_000,
                )

            async def _fake_resolve_runtime_policy(
                _session: AsyncSession,
                *,
                organization_id: UUID,
            ) -> tuple[str, object]:
                _ = organization_id
                return ("trial_7d", policy_for_tier("trial_7d"))

            monkeypatch.setattr(
                quota_service_module,
                "check_gateway_sessions_usage_capability",
                _fake_capability,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "resolve_board_scoped_agent",
                _fake_resolve_agent,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "sync_session_usage",
                _fake_sync_session_usage,
            )
            monkeypatch.setattr(
                quota_service_module,
                "resolve_runtime_policy",
                _fake_resolve_runtime_policy,
            )

            service = AgentTokenQuotaService(session)
            with pytest.raises(HTTPException) as exc_info:
                await service.sync_and_enforce(
                    session_key=agent.openclaw_session_id or "",
                    organization_id=org.id,
                    config=GatewayConfig(url="ws://gateway.example/ws"),
                )
            assert exc_info.value.status_code == 429
            assert isinstance(exc_info.value.detail, dict)
            assert exc_info.value.detail.get("code") == "quota_exceeded"
            assert exc_info.value.detail.get("resource") == "agent_daily_tokens"

            row = (
                await session.exec(
                    select(AgentTokenDailyUsage)
                    .where(col(AgentTokenDailyUsage.organization_id) == org.id)
                    .where(col(AgentTokenDailyUsage.agent_id) == agent.id),
                )
            ).first()
            assert row is not None
            assert row.blocked_at is not None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_observe_mode_does_not_block_on_quota_reached(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "observe")
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="ws://gateway.example/ws",
                workspace_root="/workspace",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
            )
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Worker",
                openclaw_session_id="agent:mc-demo:main",
            )
            usage_date_vn = date(2026, 3, 9)
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent.id,
                    usage_date_vn=usage_date_vn,
                    openclaw_tokens_total=40_000,
                    billed_tokens_used=20_000,
                ),
            )
            await session.commit()

            async def _fake_capability(_config: GatewayConfig) -> GatewayUsageCapabilityResult:
                return GatewayUsageCapabilityResult(
                    supported=True,
                    code="supported",
                    message=None,
                )

            async def _fake_resolve_agent(
                self: object,
                *,
                session_key: str,
                organization_id: object | None = None,
            ) -> Agent | None:
                _ = (self, session_key, organization_id)
                return agent

            async def _fake_sync_session_usage(
                self: object,
                *,
                agent: Agent,
                config: GatewayConfig,
                usage_date_vn: date | None = None,
            ) -> SessionUsageSyncResult:
                _ = (self, agent, config, usage_date_vn)
                return SessionUsageSyncResult(
                    agent_id=str(agent.id),
                    organization_id=str(org.id),
                    usage_date_vn=usage_date_vn or date(2026, 3, 9),
                    openclaw_total=40_000,
                    openclaw_delta=0,
                    billed_delta=0,
                    billed_total=20_000,
                )

            async def _fake_resolve_runtime_policy(
                _session: AsyncSession,
                *,
                organization_id: UUID,
            ) -> tuple[str, object]:
                _ = organization_id
                return ("trial_7d", policy_for_tier("trial_7d"))

            monkeypatch.setattr(
                quota_service_module,
                "check_gateway_sessions_usage_capability",
                _fake_capability,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "resolve_board_scoped_agent",
                _fake_resolve_agent,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "sync_session_usage",
                _fake_sync_session_usage,
            )
            monkeypatch.setattr(
                quota_service_module,
                "resolve_runtime_policy",
                _fake_resolve_runtime_policy,
            )

            out = await AgentTokenQuotaService(session).sync_and_enforce(
                session_key=agent.openclaw_session_id or "",
                organization_id=org.id,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )

            assert out is not None
            assert out.quota_reached is True
            row = (
                await session.exec(
                    select(AgentTokenDailyUsage)
                    .where(col(AgentTokenDailyUsage.organization_id) == org.id)
                    .where(col(AgentTokenDailyUsage.agent_id) == agent.id),
                )
            ).first()
            assert row is not None
            assert row.blocked_at is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_skips_board_lead_agents(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="ws://gateway.example/ws",
                workspace_root="/workspace",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
            )
            lead_agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Lead",
                is_board_lead=True,
                openclaw_session_id="agent:lead-demo:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(lead_agent)
            await session.commit()

            async def _fake_capability(_config: GatewayConfig) -> GatewayUsageCapabilityResult:
                return GatewayUsageCapabilityResult(
                    supported=True,
                    code="supported",
                    message=None,
                )

            async def _fake_resolve_agent(
                self: object,
                *,
                session_key: str,
                organization_id: object | None = None,
            ) -> Agent | None:
                _ = (self, session_key, organization_id)
                return lead_agent

            async def _unexpected_sync_session_usage(*args: object, **kwargs: object) -> object:
                _ = (args, kwargs)
                raise AssertionError("board lead should skip usage sync")

            monkeypatch.setattr(
                quota_service_module,
                "check_gateway_sessions_usage_capability",
                _fake_capability,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "resolve_board_scoped_agent",
                _fake_resolve_agent,
            )
            monkeypatch.setattr(
                quota_service_module.SessionUsageSyncService,
                "sync_session_usage",
                _unexpected_sync_session_usage,
            )

            result = await AgentTokenQuotaService(session).sync_and_enforce(
                session_key=lead_agent.openclaw_session_id or "",
                organization_id=org.id,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )

            assert result is None
    finally:
        await engine.dispose()

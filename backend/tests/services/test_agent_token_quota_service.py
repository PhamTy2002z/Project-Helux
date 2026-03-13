# ruff: noqa: INP001,S101
"""Agent token quota sync/enforcement tests."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
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
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            assert token_limit is not None
            seeded_total = max(token_limit - 20_000, 0)
            exceeded_total = token_limit + 1
            token_delta = max(exceeded_total - seeded_total, 0)
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
                    openclaw_tokens_total=seeded_total,
                    billed_tokens_used=seeded_total,
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
                    openclaw_total=exceeded_total,
                    openclaw_delta=token_delta,
                    billed_delta=token_delta,
                    billed_total=exceeded_total,
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
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            assert token_limit is not None
            seeded_total = max(token_limit - 20_000, 0)
            exceeded_total = token_limit + 1
            token_delta = max(exceeded_total - seeded_total, 0)
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
                    openclaw_tokens_total=seeded_total,
                    billed_tokens_used=seeded_total,
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
                    openclaw_total=exceeded_total,
                    openclaw_delta=token_delta,
                    billed_delta=token_delta,
                    billed_total=exceeded_total,
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
async def test_sync_and_enforce_applies_to_board_lead_agents(
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
            member_agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Member",
                is_board_lead=False,
                openclaw_session_id="agent:member-demo:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(lead_agent)
            session.add(member_agent)
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

            sync_called = False
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            assert token_limit is not None

            async def _fake_sync_session_usage(
                self: object,
                *,
                agent: Agent,
                config: GatewayConfig,
                usage_date_vn: date | None = None,
            ) -> SessionUsageSyncResult:
                nonlocal sync_called
                _ = (self, config)
                sync_called = True
                return SessionUsageSyncResult(
                    agent_id=str(agent.id),
                    organization_id=str(org.id),
                    usage_date_vn=usage_date_vn or date(2026, 3, 9),
                    openclaw_total=token_limit + 1,
                    openclaw_delta=token_limit + 1,
                    billed_delta=token_limit + 1,
                    billed_total=token_limit + 1,
                    cost_data_available=False,
                )

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
            async def _fake_resolve_runtime_policy(
                _session: AsyncSession,
                *,
                organization_id: UUID,
            ) -> tuple[str, object]:
                _ = organization_id
                return ("trial_7d", policy_for_tier("trial_7d"))

            monkeypatch.setattr(
                quota_service_module,
                "resolve_runtime_policy",
                _fake_resolve_runtime_policy,
            )

            result = await AgentTokenQuotaService(session).sync_and_enforce(
                session_key=lead_agent.openclaw_session_id or "",
                organization_id=org.id,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )

            assert sync_called is True
            assert result is not None
            assert result.agent_id == lead_agent.id
            assert result.billed_total == token_limit + 1
            assert result.quota_reached is False
            assert result.blocked_by is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_blocks_board_lead_when_all_members_are_blocked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "enforce")
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            assert token_limit is not None
            usage_date = date(2026, 3, 9)

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
            member_agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Member",
                is_board_lead=False,
                openclaw_session_id="agent:member-demo:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(lead_agent)
            session.add(member_agent)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=lead_agent.id,
                    usage_date_vn=usage_date,
                    openclaw_tokens_total=0,
                    billed_tokens_used=0,
                ),
            )
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=member_agent.id,
                    usage_date_vn=usage_date,
                    openclaw_tokens_total=token_limit + 1,
                    billed_tokens_used=token_limit + 1,
                    blocked_at=datetime(2026, 3, 9, 10, 0, 0),
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
                _ = (self, organization_id)
                if session_key == lead_agent.openclaw_session_id:
                    return lead_agent
                return None

            async def _fake_sync_session_usage(
                self: object,
                *,
                agent: Agent,
                config: GatewayConfig,
                usage_date_vn: date | None = None,
            ) -> SessionUsageSyncResult:
                _ = (self, config)
                return SessionUsageSyncResult(
                    agent_id=str(agent.id),
                    organization_id=str(org.id),
                    usage_date_vn=usage_date_vn or usage_date,
                    openclaw_total=token_limit + 1,
                    openclaw_delta=token_limit + 1,
                    billed_delta=token_limit + 1,
                    billed_total=token_limit + 1,
                    cost_data_available=False,
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
                    session_key=lead_agent.openclaw_session_id or "",
                    organization_id=org.id,
                    config=GatewayConfig(url="ws://gateway.example/ws"),
                )
            assert exc_info.value.status_code == 429
            assert isinstance(exc_info.value.detail, dict)
            assert exc_info.value.detail.get("resource") == "agent_daily_tokens"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_blocks_on_cost_quota_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cost layer blocks when cost limit exceeded (primary enforcement)."""
    from decimal import Decimal

    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "enforce")
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            cost_limit = trial_policy.agent_daily_cost
            assert token_limit is not None
            assert cost_limit is not None
            seeded_total = max(token_limit - 2, 0)
            next_total = seeded_total + 1
            token_delta = max(next_total - seeded_total, 0)
            seeded_cost = max(cost_limit - Decimal("0.10"), Decimal(0))
            exceeded_cost = cost_limit + Decimal("0.05")
            cost_delta = max(exceeded_cost - seeded_cost, Decimal(0))
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
                openclaw_session_id="agent:cost-test:main",
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
                    openclaw_tokens_total=seeded_total,
                    billed_tokens_used=seeded_total,
                    cost_used=seeded_cost,
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
                    openclaw_total=next_total,
                    openclaw_delta=token_delta,
                    billed_delta=token_delta,
                    billed_total=next_total,
                    cost_delta=cost_delta,
                    cost_total=exceeded_cost,
                    cost_data_available=True,
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
            assert exc_info.value.detail.get("resource") == "agent_daily_cost"

            row = (
                await session.exec(
                    select(AgentTokenDailyUsage)
                    .where(col(AgentTokenDailyUsage.organization_id) == org.id)
                    .where(col(AgentTokenDailyUsage.agent_id) == agent.id),
                )
            ).first()
            assert row is not None
            assert row.cost_blocked_at is not None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_and_enforce_blocks_on_token_cap_when_cost_data_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Token layer blocks when cost data unavailable (safety net)."""
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            monkeypatch.setattr(settings, "openclaw_usage_enforcement_mode", "enforce")
            trial_policy = policy_for_tier("trial_7d")
            token_limit = trial_policy.agent_daily_tokens
            assert token_limit is not None
            seeded_total = max(token_limit - 20_000, 0)
            exceeded_total = token_limit + 1
            token_delta = max(exceeded_total - seeded_total, 0)
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
                openclaw_session_id="agent:token-safety:main",
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
                    openclaw_tokens_total=seeded_total,
                    billed_tokens_used=seeded_total,
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
                    openclaw_total=exceeded_total,
                    openclaw_delta=token_delta,
                    billed_delta=token_delta,
                    billed_total=exceeded_total,
                    cost_delta=Decimal(0),
                    cost_total=Decimal(0),
                    cost_data_available=False,  # Cost data unavailable
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
async def test_sync_and_enforce_passes_when_both_layers_within_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Enforcement passes when both cost and token layers within limits."""
    from decimal import Decimal

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
                openclaw_session_id="agent:within-limits:main",
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
                    openclaw_tokens_total=10_000,
                    billed_tokens_used=10_000,
                    cost_used=Decimal("0.10"),
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
                    openclaw_total=20_000,
                    openclaw_delta=10_000,
                    billed_delta=10_000,
                    billed_total=20_000,
                    cost_delta=Decimal("0.15"),
                    cost_total=Decimal("0.25"),
                    cost_data_available=True,
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
            result = await service.sync_and_enforce(
                session_key=agent.openclaw_session_id or "",
                organization_id=org.id,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )

            assert result is not None
            assert result.quota_reached is False
            assert result.billed_total == 20_000
            assert result.billed_delta == 10_000
            assert result.cost_total == Decimal("0.25")
            assert result.cost_delta == Decimal("0.15")
            assert result.blocked_by is None
    finally:
        await engine.dispose()

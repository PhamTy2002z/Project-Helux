# ruff: noqa: INP001,S101
"""Session usage sync service tests."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import app.services.openclaw.session_usage_sync as session_usage_sync
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.schemas.openclaw_usage import OpenClawSessionUsage
from app.services.openclaw.gateway_rpc import GatewayConfig
from app.services.openclaw.session_usage_sync import SessionUsageSyncService


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


@pytest.mark.asyncio
async def test_sync_session_usage_uses_raw_tokens_no_multiplier(
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
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Worker",
                openclaw_session_id=f"agent:mc-{uuid4()}:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            await session.commit()

            totals = iter([100, 100, 103])

            async def _fake_fetch_usage(
                *,
                config: GatewayConfig,
                query: session_usage_sync.SessionUsageQuery,
            ) -> OpenClawSessionUsage:
                _ = config
                return OpenClawSessionUsage(
                    session_key=query.session_key,
                    total_tokens=next(totals),
                )

            monkeypatch.setattr(session_usage_sync, "fetch_session_usage", _fake_fetch_usage)
            service = SessionUsageSyncService(session)

            first = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()
            second = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()
            third = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()

            assert first.openclaw_delta == 0
            assert first.billed_delta == 0
            assert first.billed_total == 0
            assert second.openclaw_delta == 0
            assert second.billed_delta == 0
            assert second.billed_total == 0
            assert third.openclaw_delta == 3
            assert third.billed_delta == 3  # Raw tokens, no multiplier
            assert third.billed_total == 3

            row = (
                await session.exec(
                    select(AgentTokenDailyUsage).where(col(AgentTokenDailyUsage.agent_id) == agent.id),
                )
            ).first()
            assert row is not None
            assert row.openclaw_tokens_total == 103
            assert row.billed_tokens_used == 3  # Raw tokens, no multiplier
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_resolve_board_scoped_agent_obeys_organization_scope() -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            org = Organization(id=uuid4(), name="Org")
            other_org = Organization(id=uuid4(), name="Other")
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
            session_key = f"agent:mc-{uuid4()}:main"
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Scoped",
                openclaw_session_id=session_key,
            )
            session.add(org)
            session.add(other_org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            await session.commit()

            service = SessionUsageSyncService(session)
            matched = await service.resolve_board_scoped_agent(
                session_key=session_key,
                organization_id=org.id,
            )
            missed = await service.resolve_board_scoped_agent(
                session_key=session_key,
                organization_id=other_org.id,
            )

            assert matched is not None
            assert matched.id == agent.id
            assert missed is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_resolve_board_scoped_agent_returns_none_when_session_is_shared() -> None:
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
            session_key = f"agent:lead-{uuid4()}:main"
            agent_a = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="A",
                openclaw_session_id=session_key,
            )
            agent_b = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="B",
                openclaw_session_id=session_key,
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent_a)
            session.add(agent_b)
            await session.commit()

            service = SessionUsageSyncService(session)
            resolved = await service.resolve_board_scoped_agent(
                session_key=session_key,
                organization_id=org.id,
            )

            assert resolved is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_sync_session_usage_charges_after_initial_non_zero_baseline(
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
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Worker",
                openclaw_session_id=f"agent:mc-{uuid4()}:main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            await session.commit()

            totals = iter([0, 10, 15])

            async def _fake_fetch_usage(
                *,
                config: GatewayConfig,
                query: session_usage_sync.SessionUsageQuery,
            ) -> OpenClawSessionUsage:
                _ = config
                return OpenClawSessionUsage(
                    session_key=query.session_key,
                    total_tokens=next(totals),
                )

            monkeypatch.setattr(session_usage_sync, "fetch_session_usage", _fake_fetch_usage)
            service = SessionUsageSyncService(session)

            first = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()
            second = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()
            third = await service.sync_session_usage(
                agent=agent,
                config=GatewayConfig(url="ws://gateway.example/ws"),
            )
            await session.commit()

            assert first.openclaw_delta == 0
            assert first.billed_delta == 0
            assert first.billed_total == 0
            assert second.openclaw_delta == 0
            assert second.billed_delta == 0
            assert second.billed_total == 0
            assert third.openclaw_delta == 5
            assert third.billed_delta == 5  # Raw tokens, no multiplier
            assert third.billed_total == 5
    finally:
        await engine.dispose()

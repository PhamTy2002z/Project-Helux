# ruff: noqa: INP001
"""Entitlement policy and usage snapshot tests."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

import app.services.entitlements as entitlements_module
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.models.board_groups import BoardGroup
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task
from app.schemas.entitlements import OrganizationPlanAssign
from app.services.entitlements import (
    assign_organization_plan,
    enforce_agents_per_board_quota,
    enforce_board_quota,
    get_entitlement_usage,
    get_or_create_organization_plan,
)


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _make_session(engine: AsyncEngine) -> AsyncSession:
    return AsyncSession(engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_get_entitlement_usage_includes_current_usage_counts() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="https://gateway.example",
                workspace_root="/workspace/org",
            )
            group = BoardGroup(
                id=uuid4(),
                organization_id=org.id,
                name="Group",
                slug="group",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                board_group_id=group.id,
                name="Board",
                slug="board",
                description="Desc",
            )
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Agent",
            )
            task = Task(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                title="Task",
                created_at=utcnow(),
            )
            session.add(org)
            session.add(gateway)
            session.add(group)
            session.add(board)
            session.add(agent)
            session.add(task)
            await session.commit()

            plan = await get_or_create_organization_plan(session, organization_id=org.id)
            assert plan.tier == "trial_7d"

            usage = await get_entitlement_usage(session, organization_id=org.id)
            assert usage.plan == "trial_7d"
            usage_by_resource = {entry.resource: entry for entry in usage.quotas}
            assert usage_by_resource["board_groups"].used == 1
            assert usage_by_resource["boards"].used == 1
            assert usage_by_resource["agents_total"].used == 1
            assert usage_by_resource["agents_per_board"].used == 1
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_enforce_board_quota_raises_after_limit() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="https://gateway.example",
                workspace_root="/workspace/org",
            )
            session.add(org)
            session.add(gateway)
            await session.commit()

            await assign_organization_plan(
                session,
                organization_id=org.id,
                payload=OrganizationPlanAssign(tier="trial_7d"),
            )

            session.add(
                Board(
                    id=uuid4(),
                    organization_id=org.id,
                    gateway_id=gateway.id,
                    name="Board",
                    slug="board",
                    description="Desc",
                )
            )
            await session.commit()

            with pytest.raises(HTTPException) as exc_info:
                await enforce_board_quota(session, organization_id=org.id)
            assert exc_info.value.status_code == 429
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail.get("code") == "quota_exceeded"
            assert detail.get("resource") == "boards"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_trial_expired_blocks_runtime_actions() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            session.add(org)
            await session.commit()

            await assign_organization_plan(
                session,
                organization_id=org.id,
                payload=OrganizationPlanAssign(
                    tier="trial_7d",
                    effective_from=utcnow() - timedelta(days=8),
                    effective_until=utcnow() - timedelta(days=1),
                ),
            )

            with pytest.raises(HTTPException) as exc_info:
                await enforce_board_quota(session, organization_id=org.id)
            assert exc_info.value.status_code == 402
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail.get("code") == "blocked_for_payment"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_enforce_agents_per_board_quota_raises_after_limit() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="https://gateway.example",
                workspace_root="/workspace/org",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
                description="Desc",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            await session.commit()

            for index in range(3):
                session.add(
                    Agent(
                        id=uuid4(),
                        organization_id=org.id,
                        board_id=board.id,
                        gateway_id=gateway.id,
                        name=f"Agent {index}",
                    )
                )
            await session.commit()

            with pytest.raises(HTTPException) as exc_info:
                await enforce_agents_per_board_quota(
                    session,
                    organization_id=org.id,
                    board_id=board.id,
                )
            assert exc_info.value.status_code == 429
            detail = exc_info.value.detail
            assert isinstance(detail, dict)
            assert detail.get("resource") == "agents_per_board"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_entitlement_usage_reads_token_usage_from_ledger(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        fixed_now = datetime(2026, 3, 15, 12, 0, 0)
        monkeypatch.setattr(entitlements_module, "utcnow", lambda: fixed_now)
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Gateway",
                url="https://gateway.example",
                workspace_root="/workspace/org",
            )
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board",
                slug="board",
                description="Desc",
            )
            agent_a = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Agent A",
            )
            agent_b = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Agent B",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent_a)
            session.add(agent_b)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent_a.id,
                    usage_date_vn=datetime(2026, 3, 15).date(),
                    billed_tokens_used=12_000,
                    openclaw_tokens_total=24_000,
                ),
            )
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent_b.id,
                    usage_date_vn=datetime(2026, 3, 15).date(),
                    billed_tokens_used=3_000,
                    openclaw_tokens_total=6_000,
                ),
            )
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent_a.id,
                    usage_date_vn=datetime(2026, 3, 14).date(),
                    billed_tokens_used=5_000,
                    openclaw_tokens_total=10_000,
                ),
            )
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=agent_b.id,
                    usage_date_vn=datetime(2026, 2, 28).date(),
                    billed_tokens_used=9_000,
                    openclaw_tokens_total=18_000,
                ),
            )
            await session.commit()

            usage = await get_entitlement_usage(session, organization_id=org.id)
            usage_by_resource = {entry.resource: entry for entry in usage.quotas}
            assert usage_by_resource["org_daily_tokens"].used == 15_000
            assert usage_by_resource["agent_daily_tokens"].used == 12_000
            assert usage_by_resource["org_monthly_tokens"].used == 20_000
            assert usage_by_resource["trial_total_tokens"].used == 29_000
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_entitlement_usage_falls_back_to_plan_metadata_when_ledger_empty() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            session.add(org)
            await session.commit()

            await assign_organization_plan(
                session,
                organization_id=org.id,
                payload=OrganizationPlanAssign(
                    tier="trial_7d",
                    plan_metadata={
                        "token_usage": {
                            "org_daily": 111,
                            "agent_daily": 77,
                            "org_monthly": 888,
                            "trial_total": 999,
                        },
                    },
                ),
            )

            usage = await get_entitlement_usage(session, organization_id=org.id)
            usage_by_resource = {entry.resource: entry for entry in usage.quotas}
            assert usage_by_resource["org_daily_tokens"].used == 111
            assert usage_by_resource["agent_daily_tokens"].used == 77
            assert usage_by_resource["org_monthly_tokens"].used == 888
            assert usage_by_resource["trial_total_tokens"].used == 999
    finally:
        await engine.dispose()

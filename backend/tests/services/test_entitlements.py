# ruff: noqa: INP001
"""Entitlement policy and usage snapshot tests."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.time import utcnow
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task
from app.schemas.entitlements import OrganizationPlanAssign
from app.services.entitlements import (
    assign_organization_plan,
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
            board = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
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
            session.add(board)
            session.add(agent)
            session.add(task)
            await session.commit()

            plan = await get_or_create_organization_plan(session, organization_id=org.id)
            assert plan.tier == "free"

            usage = await get_entitlement_usage(session, organization_id=org.id)
            assert usage.plan == "free"
            usage_by_resource = {entry.resource: entry for entry in usage.quotas}
            assert usage_by_resource["boards"].used == 1
            assert usage_by_resource["agents"].used == 1
            assert usage_by_resource["tasks_created_monthly"].used == 1
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
                payload=OrganizationPlanAssign(tier="free"),
            )

            for index in range(3):
                session.add(
                    Board(
                        id=uuid4(),
                        organization_id=org.id,
                        gateway_id=gateway.id,
                        name=f"Board {index}",
                        slug=f"board-{index}",
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

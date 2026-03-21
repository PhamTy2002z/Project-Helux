# ruff: noqa: INP001
"""Regression tests for review tracking on task creation."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import tasks as tasks_api
from app.core.auth import AuthContext
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.schemas.tasks import TaskCreate


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _make_session(engine: AsyncEngine) -> AsyncSession:
    return AsyncSession(engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_create_review_task_preserves_original_worker_as_owner() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org_id = uuid4()
            board_id = uuid4()
            gateway_id = uuid4()
            worker_id = uuid4()
            lead_id = uuid4()

            session.add(Organization(id=org_id, name="org"))
            session.add(
                Gateway(
                    id=gateway_id,
                    organization_id=org_id,
                    name="gateway",
                    url="https://gateway.local",
                    workspace_root="/tmp/workspace",
                ),
            )
            session.add(
                Board(
                    id=board_id,
                    organization_id=org_id,
                    name="board",
                    slug="board",
                    gateway_id=gateway_id,
                    review_sla_minutes=30,
                ),
            )
            session.add(
                Agent(
                    id=worker_id,
                    organization_id=org_id,
                    board_id=board_id,
                    gateway_id=gateway_id,
                    name="worker",
                    status="online",
                ),
            )
            session.add(
                Agent(
                    id=lead_id,
                    organization_id=org_id,
                    board_id=board_id,
                    gateway_id=gateway_id,
                    name="Lead Agent",
                    status="online",
                    is_board_lead=True,
                ),
            )
            await session.commit()

            board = await Board.objects.by_id(board_id).first(session)
            assert board is not None

            created = await tasks_api.create_task(
                payload=TaskCreate(
                    title="ready",
                    description="ready for review",
                    status="review",
                    assigned_agent_id=worker_id,
                ),
                board=board,
                session=session,
                auth=AuthContext(actor_type="user", user=None),
            )

            assert created.status == "review"
            assert created.assigned_agent_id == lead_id
            assert created.reviewer_agent_id == lead_id
            assert created.owner_agent_id == worker_id
            assert created.review_entered_at is not None
            assert created.review_due_at is not None
    finally:
        await engine.dispose()

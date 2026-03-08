# ruff: noqa: INP001
"""Tenant invariant validation tests for cross-org references."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task
from app.services.tenant_invariants import require_agent_in_board, require_tasks_in_board


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _make_session(engine: AsyncEngine) -> AsyncSession:
    return AsyncSession(engine, expire_on_commit=False)


@pytest.mark.asyncio
async def test_require_agent_in_board_rejects_cross_board_assignment() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org = Organization(id=uuid4(), name="Org")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="G",
                url="https://gateway.example",
                workspace_root="/workspace/org",
            )
            board_a = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board A",
                slug="board-a",
                description="A",
            )
            board_b = Board(
                id=uuid4(),
                organization_id=org.id,
                gateway_id=gateway.id,
                name="Board B",
                slug="board-b",
                description="B",
            )
            agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board_a.id,
                gateway_id=gateway.id,
                name="Worker",
            )
            session.add(org)
            session.add(gateway)
            session.add(board_a)
            session.add(board_b)
            session.add(agent)
            await session.commit()

            with pytest.raises(HTTPException):
                await require_agent_in_board(
                    session,
                    agent_id=agent.id,
                    board_id=board_b.id,
                    organization_id=org.id,
                )
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_require_tasks_in_board_rejects_cross_org_task_ids() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            org_a = Organization(id=uuid4(), name="Org A")
            org_b = Organization(id=uuid4(), name="Org B")
            gateway_a = Gateway(
                id=uuid4(),
                organization_id=org_a.id,
                name="G-A",
                url="https://gateway-a.example",
                workspace_root="/workspace/a",
            )
            gateway_b = Gateway(
                id=uuid4(),
                organization_id=org_b.id,
                name="G-B",
                url="https://gateway-b.example",
                workspace_root="/workspace/b",
            )
            board_a = Board(
                id=uuid4(),
                organization_id=org_a.id,
                gateway_id=gateway_a.id,
                name="Board A",
                slug="board-a",
                description="A",
            )
            board_b = Board(
                id=uuid4(),
                organization_id=org_b.id,
                gateway_id=gateway_b.id,
                name="Board B",
                slug="board-b",
                description="B",
            )
            foreign_task = Task(
                id=uuid4(),
                organization_id=org_b.id,
                board_id=board_b.id,
                title="Foreign Task",
            )
            session.add(org_a)
            session.add(org_b)
            session.add(gateway_a)
            session.add(gateway_b)
            session.add(board_a)
            session.add(board_b)
            session.add(foreign_task)
            await session.commit()

            with pytest.raises(HTTPException):
                await require_tasks_in_board(
                    session,
                    task_ids=[foreign_task.id],
                    board_id=board_a.id,
                    organization_id=org_a.id,
                )
    finally:
        await engine.dispose()

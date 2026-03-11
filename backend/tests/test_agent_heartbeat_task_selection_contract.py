# ruff: noqa: S101
"""Contract tests for lead/worker heartbeat task selection recipes."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import tasks as tasks_api
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _seed_loop_fixture(session: AsyncSession) -> tuple[UUID, UUID, UUID, UUID]:
    org_id = uuid4()
    gateway_id = uuid4()
    board_id = uuid4()
    worker_id = uuid4()
    lead_id = uuid4()
    t0 = datetime(2026, 3, 1, 9, 0, 0)

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
            id=board_id, organization_id=org_id, name="board", slug="board", gateway_id=gateway_id
        )
    )
    session.add(Agent(id=worker_id, name="worker", board_id=board_id, gateway_id=gateway_id))
    session.add(
        Agent(id=lead_id, name="lead", board_id=board_id, gateway_id=gateway_id, is_board_lead=True)
    )

    worker_progress = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Worker In Progress",
        status="in_progress",
        assigned_agent_id=worker_id,
        created_at=t0,
        updated_at=t0,
    )
    worker_inbox = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Worker Inbox",
        status="inbox",
        assigned_agent_id=worker_id,
        created_at=t0 + timedelta(seconds=1),
        updated_at=t0 + timedelta(seconds=1),
    )
    lead_unassigned = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Lead Delegation",
        status="inbox",
        created_at=t0 + timedelta(seconds=2),
        updated_at=t0 + timedelta(seconds=2),
    )
    session.add_all([worker_progress, worker_inbox, lead_unassigned])
    await session.commit()
    return board_id, worker_id, worker_progress.id, lead_unassigned.id


@pytest.mark.asyncio
async def test_worker_recipe_prefers_in_progress_before_inbox() -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            board_id, worker_id, in_progress_id, _ = await _seed_loop_fixture(session)
            filters = tasks_api._task_query_filters(
                q=None,
                tag_ids_filter=None,
                priority_filter=None,
                blocked=None,
                due_before=None,
                due_after=None,
                has_pending_approval=None,
                task_group_id=None,
                archived=False,
            )
            in_progress = list(
                await session.exec(
                    tasks_api._task_list_statement(
                        board_id=board_id,
                        status_filter="in_progress",
                        assigned_agent_id=worker_id,
                        unassigned=False,
                        filters=filters,
                    ).limit(1),
                ),
            )
            assert [task.id for task in in_progress] == [in_progress_id]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_lead_recipe_finds_unassigned_inbox_tasks() -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            board_id, _worker_id, _in_progress_id, lead_queue_id = await _seed_loop_fixture(session)
            filters = tasks_api._task_query_filters(
                q=None,
                tag_ids_filter=None,
                priority_filter=None,
                blocked=None,
                due_before=None,
                due_after=None,
                has_pending_approval=None,
                task_group_id=None,
                archived=False,
            )
            lead_queue = list(
                await session.exec(
                    tasks_api._task_list_statement(
                        board_id=board_id,
                        status_filter="inbox",
                        assigned_agent_id=None,
                        unassigned=True,
                        filters=filters,
                    ),
                ),
            )
            assert lead_queue
            assert lead_queue[0].id == lead_queue_id
    finally:
        await engine.dispose()

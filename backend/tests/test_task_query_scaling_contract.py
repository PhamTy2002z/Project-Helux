# ruff: noqa: S101
"""Regression tests for additive task query filters and cursor pagination."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import tasks as tasks_api
from app.models.approvals import Approval
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tag_assignments import TagAssignment
from app.models.tags import Tag
from app.models.task_dependencies import TaskDependency
from app.models.task_groups import TaskGroup
from app.models.tasks import Task


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _seed_query_fixture(session: AsyncSession) -> dict[str, object]:
    org_id = uuid4()
    gateway_id = uuid4()
    board_id = uuid4()
    group_id = uuid4()
    tag_id = uuid4()
    base_time = datetime(2026, 3, 1, 12, 0, 0)

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
        ),
    )
    session.add(
        TaskGroup(
            id=group_id,
            organization_id=org_id,
            board_id=board_id,
            title="Planning Group",
        ),
    )
    session.add(Tag(id=tag_id, organization_id=org_id, name="critical", slug="critical"))

    dep_open = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Dependency Open",
        status="inbox",
        created_at=base_time,
        updated_at=base_time,
    )
    dep_done = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Dependency Done",
        status="done",
        created_at=base_time + timedelta(seconds=1),
        updated_at=base_time + timedelta(seconds=1),
    )
    ready = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Ready Task",
        status="in_progress",
        priority="high",
        due_at=base_time + timedelta(days=1),
        task_group_id=group_id,
        created_at=base_time + timedelta(seconds=2),
        updated_at=base_time + timedelta(seconds=2),
    )
    blocked = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Blocked Task",
        status="inbox",
        created_at=base_time + timedelta(seconds=3),
        updated_at=base_time + timedelta(seconds=3),
    )
    pending = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Pending Approval Task",
        status="review",
        created_at=base_time + timedelta(seconds=4),
        updated_at=base_time + timedelta(seconds=4),
    )
    archived = Task(
        board_id=board_id,
        organization_id=org_id,
        title="Archived Task",
        status="done",
        archived_at=base_time + timedelta(days=3),
        created_at=base_time + timedelta(seconds=5),
        updated_at=base_time + timedelta(seconds=5),
    )
    session.add_all([dep_open, dep_done, ready, blocked, pending, archived])
    await session.flush()

    session.add(TagAssignment(task_id=ready.id, tag_id=tag_id))
    session.add(
        TaskDependency(board_id=board_id, task_id=blocked.id, depends_on_task_id=dep_open.id)
    )
    session.add(TaskDependency(board_id=board_id, task_id=ready.id, depends_on_task_id=dep_done.id))
    session.add(
        Approval(
            board_id=board_id,
            organization_id=org_id,
            task_id=pending.id,
            action_type="deploy",
            confidence=0.9,
            status="pending",
        ),
    )
    await session.commit()
    return {
        "board_id": board_id,
        "ready_id": ready.id,
        "blocked_id": blocked.id,
        "pending_id": pending.id,
    }


@pytest.mark.asyncio
async def test_task_list_statement_applies_additive_filters() -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            seeded = await _seed_query_fixture(session)
            filters = tasks_api._task_query_filters(
                q="Ready",
                tag_ids_filter=None,
                priority_filter="high",
                blocked=False,
                due_before=datetime(2026, 3, 3, 0, 0, 0),
                due_after=datetime(2026, 3, 1, 0, 0, 0),
                has_pending_approval=False,
                task_group_id=None,
                archived=False,
            )
            statement = tasks_api._task_list_statement(
                board_id=seeded["board_id"],
                status_filter="in_progress",
                assigned_agent_id=None,
                unassigned=None,
                filters=filters,
            )
            rows = list(await session.exec(statement))
            assert [row.id for row in rows] == [seeded["ready_id"]]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_task_list_statement_blocked_and_pending_filters() -> None:
    engine = await _make_engine()
    try:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            seeded = await _seed_query_fixture(session)
            blocked_statement = tasks_api._task_list_statement(
                board_id=seeded["board_id"],
                status_filter=None,
                assigned_agent_id=None,
                unassigned=None,
                filters=tasks_api._task_query_filters(
                    q=None,
                    tag_ids_filter=None,
                    priority_filter=None,
                    blocked=True,
                    due_before=None,
                    due_after=None,
                    has_pending_approval=None,
                    task_group_id=None,
                    archived=None,
                ),
            )
            pending_statement = tasks_api._task_list_statement(
                board_id=seeded["board_id"],
                status_filter=None,
                assigned_agent_id=None,
                unassigned=None,
                filters=tasks_api._task_query_filters(
                    q=None,
                    tag_ids_filter=None,
                    priority_filter=None,
                    blocked=None,
                    due_before=None,
                    due_after=None,
                    has_pending_approval=True,
                    task_group_id=None,
                    archived=None,
                ),
            )
            assert seeded["blocked_id"] in {
                task.id for task in await session.exec(blocked_statement)
            }
            assert seeded["pending_id"] in {
                task.id for task in await session.exec(pending_statement)
            }
    finally:
        await engine.dispose()


def test_task_cursor_roundtrip_and_invalid_payload() -> None:
    token = tasks_api._encode_task_cursor(
        tasks_api.TaskCursorToken(created_at=datetime(2026, 3, 1, 0, 0, 0), task_id=uuid4()),
    )
    decoded = tasks_api._decode_task_cursor(token)
    assert decoded is not None
    assert decoded.created_at == datetime(2026, 3, 1, 0, 0, 0)
    with pytest.raises(HTTPException):
        tasks_api._decode_task_cursor("not-a-valid-token")

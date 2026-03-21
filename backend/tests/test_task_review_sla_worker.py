# ruff: noqa: INP001
"""Worker behavior tests for task review SLA deadline processing."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import app.services.task_review_sla_worker as review_sla_worker
from app.core.time import utcnow
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task
from app.services.queue import QueuedTask
from app.services.task_review_sla_queue import TASK_TYPE
from app.services.task_review_sla_worker import _next_delay_seconds


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


def _queued_deadline_task(task_id: UUID) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={"task_id": str(task_id)},
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_review_sla_worker_marks_overdue_and_reschedules(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        monkeypatch.setattr(review_sla_worker, "async_session_maker", session_factory)
        monkeypatch.setattr(review_sla_worker.settings, "task_review_sla_auto_reassign_after", 3)
        monkeypatch.setattr(review_sla_worker.settings, "task_review_sla_retry_backoff_seconds", "60")

        requeues: list[float] = []
        monkeypatch.setattr(
            review_sla_worker,
            "enqueue_task_review_sla_deadline",
            lambda task_id, delay_seconds: requeues.append(delay_seconds) or True,
        )

        async def _fake_send_agent_message(**_: object) -> None:
            return None

        monkeypatch.setattr(review_sla_worker, "_send_agent_message", _fake_send_agent_message)

        org_id = uuid4()
        board_id = uuid4()
        gateway_id = uuid4()
        reviewer_id = uuid4()
        owner_id = uuid4()
        task_id = uuid4()
        now = utcnow()

        async with session_factory() as session:
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
                    review_sla_minutes=20,
                ),
            )
            session.add(
                Agent(
                    id=reviewer_id,
                    organization_id=org_id,
                    name="reviewer",
                    board_id=board_id,
                    gateway_id=gateway_id,
                    status="online",
                ),
            )
            session.add(
                Agent(
                    id=owner_id,
                    organization_id=org_id,
                    name="owner",
                    board_id=board_id,
                    gateway_id=gateway_id,
                    status="online",
                ),
            )
            session.add(
                Task(
                    id=task_id,
                    board_id=board_id,
                    organization_id=org_id,
                    title="Task",
                    status="review",
                    assigned_agent_id=reviewer_id,
                    reviewer_agent_id=reviewer_id,
                    owner_agent_id=owner_id,
                    review_entered_at=now - timedelta(minutes=25),
                    review_due_at=now - timedelta(minutes=1),
                    review_overdue_count=0,
                ),
            )
            await session.commit()

        await review_sla_worker.process_task_review_sla_deadline_task(_queued_deadline_task(task_id))

        async with session_factory() as session:
            updated = (await session.exec(select(Task).where(col(Task.id) == task_id))).first()
            assert updated is not None
            assert updated.status == "review"
            assert updated.review_overdue_count == 1
            assert updated.last_nudged_at is not None
            assert updated.review_due_at is not None
            assert updated.review_due_at > now

        assert requeues == [60.0]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_review_sla_worker_auto_reassigns_to_owner_after_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    try:
        session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        monkeypatch.setattr(review_sla_worker, "async_session_maker", session_factory)
        monkeypatch.setattr(review_sla_worker.settings, "task_review_sla_auto_reassign_after", 2)
        monkeypatch.setattr(review_sla_worker.settings, "task_review_sla_retry_backoff_seconds", "60")

        requeues: list[float] = []
        monkeypatch.setattr(
            review_sla_worker,
            "enqueue_task_review_sla_deadline",
            lambda task_id, delay_seconds: requeues.append(delay_seconds) or True,
        )

        async def _fake_send_agent_message(**_: object) -> None:
            return None

        monkeypatch.setattr(review_sla_worker, "_send_agent_message", _fake_send_agent_message)

        org_id = uuid4()
        board_id = uuid4()
        gateway_id = uuid4()
        reviewer_id = uuid4()
        owner_id = uuid4()
        task_id = uuid4()
        now = utcnow()

        async with session_factory() as session:
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
                    review_sla_minutes=20,
                ),
            )
            session.add(
                Agent(
                    id=reviewer_id,
                    organization_id=org_id,
                    name="reviewer",
                    board_id=board_id,
                    gateway_id=gateway_id,
                    status="online",
                ),
            )
            session.add(
                Agent(
                    id=owner_id,
                    organization_id=org_id,
                    name="owner",
                    board_id=board_id,
                    gateway_id=gateway_id,
                    status="online",
                ),
            )
            session.add(
                Task(
                    id=task_id,
                    board_id=board_id,
                    organization_id=org_id,
                    title="Task",
                    status="review",
                    assigned_agent_id=reviewer_id,
                    reviewer_agent_id=reviewer_id,
                    owner_agent_id=owner_id,
                    review_entered_at=now - timedelta(minutes=25),
                    review_due_at=now - timedelta(minutes=1),
                    review_overdue_count=1,
                ),
            )
            await session.commit()

        await review_sla_worker.process_task_review_sla_deadline_task(_queued_deadline_task(task_id))

        async with session_factory() as session:
            updated = (await session.exec(select(Task).where(col(Task.id) == task_id))).first()
            assert updated is not None
            assert updated.status == "inbox"
            assert updated.assigned_agent_id == owner_id
            assert updated.reviewer_agent_id is None
            assert updated.review_entered_at is None
            assert updated.review_due_at is None
            assert updated.review_overdue_count == 2
            assert updated.last_nudged_at is not None

        assert requeues == []
    finally:
        await engine.dispose()


def test_review_sla_worker_backoff_falls_back_to_default_when_invalid(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(review_sla_worker.settings, "task_review_sla_retry_backoff_seconds", "abc")
    assert _next_delay_seconds(overdue_count=1) == 600.0

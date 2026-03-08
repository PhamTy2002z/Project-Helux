# ruff: noqa: INP001
"""Gateway activation worker behavior tests."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.services.openclaw.gateway_activation_worker import process_gateway_activation_task
from app.services.queue import QueuedTask


@pytest.mark.asyncio
async def test_gateway_activation_worker_marks_ready_on_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)

    org_id = uuid4()
    gateway_id = uuid4()
    async with session_maker() as session:
        session.add(Organization(id=org_id, name="Org"))
        session.add(
            Gateway(
                id=gateway_id,
                organization_id=org_id,
                name="Primary",
                url="ws://gateway.example:18789/ws",
                workspace_root="/tmp/workspace",
            ),
        )
        await session.commit()

    async def _fake_assert(self: object, **_kwargs: object) -> None:
        _ = self

    async def _fake_ensure(self: object, *_args: object, **_kwargs: object) -> None:
        _ = self

    monkeypatch.setattr("app.services.openclaw.gateway_activation_worker.async_session_maker", session_maker)
    monkeypatch.setattr(
        "app.services.openclaw.admin_service.GatewayAdminLifecycleService.assert_gateway_runtime_compatible",
        _fake_assert,
    )
    monkeypatch.setattr(
        "app.services.openclaw.admin_service.GatewayAdminLifecycleService.ensure_main_agent",
        _fake_ensure,
    )

    task = QueuedTask(
        task_type="gateway_activation",
        payload={"gateway_id": str(gateway_id), "action": "provision"},
        created_at=datetime.now(),
        attempts=0,
    )
    await process_gateway_activation_task(task)

    async with session_maker() as session:
        gateway = await Gateway.objects.by_id(gateway_id).first(session)
        assert gateway is not None
        assert gateway.activation_status == "ready"
        assert gateway.activation_error is None
        assert gateway.activation_attempts == 1

    await engine.dispose()


@pytest.mark.asyncio
async def test_gateway_activation_worker_marks_degraded_without_retry_for_422(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)

    org_id = uuid4()
    gateway_id = uuid4()
    async with session_maker() as session:
        session.add(Organization(id=org_id, name="Org"))
        session.add(
            Gateway(
                id=gateway_id,
                organization_id=org_id,
                name="Primary",
                url="ws://gateway.example:18789/ws",
                workspace_root="/tmp/workspace",
            ),
        )
        await session.commit()

    async def _fake_assert(self: object, **_kwargs: object) -> None:
        _ = self
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="unsupported")

    monkeypatch.setattr("app.services.openclaw.gateway_activation_worker.async_session_maker", session_maker)
    monkeypatch.setattr(
        "app.services.openclaw.admin_service.GatewayAdminLifecycleService.assert_gateway_runtime_compatible",
        _fake_assert,
    )

    task = QueuedTask(
        task_type="gateway_activation",
        payload={"gateway_id": str(gateway_id), "action": "provision"},
        created_at=datetime.now(),
        attempts=0,
    )
    await process_gateway_activation_task(task)

    async with session_maker() as session:
        gateway = await Gateway.objects.by_id(gateway_id).first(session)
        assert gateway is not None
        assert gateway.activation_status == "degraded"
        assert gateway.activation_error == "unsupported"

    await engine.dispose()


@pytest.mark.asyncio
async def test_gateway_activation_worker_raises_for_retryable_5xx(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)

    org_id = uuid4()
    gateway_id = uuid4()
    async with session_maker() as session:
        session.add(Organization(id=org_id, name="Org"))
        session.add(
            Gateway(
                id=gateway_id,
                organization_id=org_id,
                name="Primary",
                url="ws://gateway.example:18789/ws",
                workspace_root="/tmp/workspace",
            ),
        )
        await session.commit()

    async def _fake_assert(self: object, **_kwargs: object) -> None:
        _ = self
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gateway down")

    monkeypatch.setattr("app.services.openclaw.gateway_activation_worker.async_session_maker", session_maker)
    monkeypatch.setattr(
        "app.services.openclaw.admin_service.GatewayAdminLifecycleService.assert_gateway_runtime_compatible",
        _fake_assert,
    )

    task = QueuedTask(
        task_type="gateway_activation",
        payload={"gateway_id": str(gateway_id), "action": "provision"},
        created_at=datetime.now(),
        attempts=0,
    )
    with pytest.raises(RuntimeError, match="gateway down"):
        await process_gateway_activation_task(task)

    async with session_maker() as session:
        gateway = await Gateway.objects.by_id(gateway_id).first(session)
        assert gateway is not None
        assert gateway.activation_status == "degraded"
        assert gateway.activation_error == "gateway down"

    await engine.dispose()

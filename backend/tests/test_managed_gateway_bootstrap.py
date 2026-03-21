# ruff: noqa: INP001
"""Tests for managed gateway bootstrap on organization creation."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agents import Agent
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.services.openclaw.managed_gateway_bootstrap import (
    ensure_managed_gateway_for_organization,
)


async def _build_session_maker() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return session_maker


def _patch_managed_settings(
    monkeypatch: pytest.MonkeyPatch, *, auto_provision: bool = True
) -> None:
    monkeypatch.setattr("app.core.config.settings.managed_gateway_auto_provision", auto_provision)
    monkeypatch.setattr("app.core.config.settings.managed_gateway_name", "Managed Gateway")
    monkeypatch.setattr(
        "app.core.config.settings.managed_gateway_url",
        "ws://gateway.example:18789/ws",
    )
    monkeypatch.setattr("app.core.config.settings.managed_gateway_token", "token-123")
    monkeypatch.setattr(
        "app.core.config.settings.managed_gateway_workspace_root",
        "/srv/openclaw/managed",
    )
    monkeypatch.setattr("app.core.config.settings.managed_gateway_disable_device_pairing", True)
    monkeypatch.setattr("app.core.config.settings.managed_gateway_allow_insecure_tls", False)


async def _create_org(session: AsyncSession, org_id: UUID) -> None:
    session.add(Organization(id=org_id, name="Org"))
    await session.commit()


@pytest.mark.asyncio
async def test_bootstrap_creates_gateway_and_main_agent(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_managed_settings(monkeypatch)
    session_maker = await _build_session_maker()
    org_id = uuid4()

    captured: dict[str, str] = {}

    def _fake_enqueue(payload: object) -> bool:
        captured["value"] = str(payload)
        return True

    monkeypatch.setattr(
        "app.services.openclaw.managed_gateway_bootstrap.enqueue_gateway_activation",
        _fake_enqueue,
    )

    async with session_maker() as session:
        await _create_org(session, org_id)
        gateway = await ensure_managed_gateway_for_organization(session, organization_id=org_id)
        assert gateway is not None
        await session.commit()

        reloaded_gateway = await Gateway.objects.by_id(gateway.id).first(session)
        assert reloaded_gateway is not None
        assert reloaded_gateway.organization_id == org_id
        assert reloaded_gateway.activation_status == "activating"
        assert reloaded_gateway.workspace_root.endswith(f"/org-{org_id}")

        main_agent = (
            await Agent.objects.filter_by(gateway_id=gateway.id)
            .filter(col(Agent.board_id).is_(None))
            .first(session)
        )
        assert main_agent is not None
        assert main_agent.organization_id == org_id
        assert main_agent.name == f"Managed GateWay Agent - {gateway.id}"

    assert "provision" in captured["value"]


@pytest.mark.asyncio
async def test_bootstrap_reuses_existing_gateway_and_backfills_main_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_managed_settings(monkeypatch)
    session_maker = await _build_session_maker()
    org_id = uuid4()
    gateway_id = uuid4()

    async with session_maker() as session:
        await _create_org(session, org_id)
        session.add(
            Gateway(
                id=gateway_id,
                organization_id=org_id,
                name="Existing",
                url="ws://gateway.example:18789/ws",
                token="token-123",
                workspace_root="/srv/openclaw/managed/org-existing",
            ),
        )
        await session.commit()

        gateway = await ensure_managed_gateway_for_organization(session, organization_id=org_id)
        assert gateway is not None
        assert gateway.id == gateway_id
        await session.commit()

        main_agents = await session.exec(
            select(Agent).where(Agent.gateway_id == gateway_id).where(Agent.board_id.is_(None)),
        )
        main_agents_list = list(main_agents)
        assert len(main_agents_list) == 1
        assert main_agents_list[0].name == "Existing Gateway Agent"


@pytest.mark.asyncio
async def test_bootstrap_reconciles_managed_gateway_token_on_existing_record(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_managed_settings(monkeypatch)
    session_maker = await _build_session_maker()
    org_id = uuid4()
    gateway_id = uuid4()

    async with session_maker() as session:
        await _create_org(session, org_id)
        session.add(
            Gateway(
                id=gateway_id,
                organization_id=org_id,
                name="Managed Gateway",
                url="ws://gateway.example:18789/ws",
                token="stale-token",
                workspace_root=f"/srv/openclaw/managed/org-{org_id}",
            ),
        )
        await session.commit()

        gateway = await ensure_managed_gateway_for_organization(session, organization_id=org_id)
        assert gateway is not None
        await session.commit()

        reloaded_gateway = await Gateway.objects.by_id(gateway_id).first(session)
        assert reloaded_gateway is not None
        assert reloaded_gateway.token == "token-123"


@pytest.mark.asyncio
async def test_bootstrap_marks_gateway_degraded_when_enqueue_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_managed_settings(monkeypatch)
    session_maker = await _build_session_maker()
    org_id = uuid4()

    monkeypatch.setattr(
        "app.services.openclaw.managed_gateway_bootstrap.enqueue_gateway_activation",
        lambda _payload: False,
    )

    async with session_maker() as session:
        await _create_org(session, org_id)
        gateway = await ensure_managed_gateway_for_organization(session, organization_id=org_id)
        assert gateway is not None
        await session.commit()

        reloaded_gateway = await Gateway.objects.by_id(gateway.id).first(session)
        assert reloaded_gateway is not None
        assert reloaded_gateway.activation_status == "degraded"
        assert reloaded_gateway.activation_error == "Failed to enqueue gateway activation task"

# ruff: noqa: INP001
"""Authorization coverage for sensitive agents endpoints."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI
from fastapi_pagination import add_pagination
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import agents as agents_api
from app.api.agents import router as agents_router
from app.api.deps import require_org_admin
from app.core.agent_tokens import verify_agent_token
from app.core.time import utcnow
from app.db.session import get_session
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organization_members import OrganizationMember
from app.models.organizations import Organization
from app.services.openclaw.session_usage_sync import SessionUsageSyncService
from app.services.organizations import OrganizationContext


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


def _build_test_app(
    session_maker: async_sessionmaker[AsyncSession],
    *,
    ctx: OrganizationContext,
) -> FastAPI:
    app = FastAPI()
    api_v1 = APIRouter(prefix="/api/v1")
    api_v1.include_router(agents_router)
    app.include_router(api_v1)
    add_pagination(app)

    async def _override_get_session() -> AsyncSession:
        async with session_maker() as session:
            yield session

    async def _override_require_org_admin() -> OrganizationContext:
        return ctx

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[require_org_admin] = _override_require_org_admin
    return app


def _owner_ctx(org: Organization) -> OrganizationContext:
    return OrganizationContext(
        organization=org,
        member=OrganizationMember(
            organization_id=org.id,
            user_id=uuid4(),
            role="owner",
            all_boards_read=True,
            all_boards_write=True,
        ),
    )


@pytest.mark.asyncio
async def test_rotate_agent_token_rejects_cross_org_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            caller_org = Organization(id=uuid4(), name="Caller Org")
            foreign_org = Organization(id=uuid4(), name="Foreign Org")
            foreign_gateway = Gateway(
                id=uuid4(),
                organization_id=foreign_org.id,
                name="Foreign Gateway",
                url="https://foreign-gateway.example",
                workspace_root="/workspace/foreign",
            )
            foreign_board = Board(
                id=uuid4(),
                organization_id=foreign_org.id,
                gateway_id=foreign_gateway.id,
                name="Foreign Board",
                slug="foreign-board",
            )
            foreign_agent = Agent(
                id=uuid4(),
                board_id=foreign_board.id,
                gateway_id=foreign_gateway.id,
                name="Foreign Agent",
            )
            session.add(caller_org)
            session.add(foreign_org)
            session.add(foreign_gateway)
            session.add(foreign_board)
            session.add(foreign_agent)
            await session.commit()

        async def _noop_sync(_agent: Agent, _raw_token: str, _session: object) -> None:
            return None

        monkeypatch.setattr(agents_api, "_sync_token_to_gateway", _noop_sync)
        app = _build_test_app(session_maker, ctx=_owner_ctx(caller_org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(f"/api/v1/agents/{foreign_agent.id}/rotate-token")

        assert response.status_code == 404
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_rotate_agent_token_allows_same_org_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
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
            )
            agent = Agent(
                id=uuid4(),
                board_id=board.id,
                gateway_id=gateway.id,
                name="Agent",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(agent)
            await session.commit()

        async def _noop_sync(_agent: Agent, _raw_token: str, _session: object) -> None:
            return None

        monkeypatch.setattr(agents_api, "_sync_token_to_gateway", _noop_sync)
        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(f"/api/v1/agents/{agent.id}/rotate-token")

        assert response.status_code == 200
        payload = response.json()
        assert payload["agent_id"] == str(agent.id)
        assert payload["agent_name"] == "Agent"
        token = payload["token"]
        assert isinstance(token, str)
        assert token

        async with session_maker() as session:
            db_agent = await Agent.objects.by_id(agent.id).first(session)
            assert db_agent is not None
            assert db_agent.agent_token_hash is not None
            assert verify_agent_token(token, db_agent.agent_token_hash)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_list_agents_includes_token_fields_for_board_scoped_agents() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        usage_date_vn = SessionUsageSyncService.vn_usage_date()
        async with session_maker() as session:
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
            )
            board_agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Board Agent",
            )
            gateway_main = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=None,
                gateway_id=gateway.id,
                name="Gateway Main",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(board_agent)
            session.add(gateway_main)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=board_agent.id,
                    usage_date_vn=usage_date_vn,
                    billed_tokens_used=12_345,
                    openclaw_tokens_total=24_690,
                ),
            )
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/agents")

        assert response.status_code == 200
        payload = response.json()
        items = payload.get("items", [])
        by_id = {item["id"]: item for item in items}
        board_item = by_id[str(board_agent.id)]
        assert board_item["token_used_today"] == 12_345
        assert board_item["token_limit_today"] == 5_000_000
        assert board_item["token_remaining_today"] == 5_000_000 - 12_345
        assert board_item["token_blocked"] is False
        assert isinstance(board_item["token_reset_at"], str)

        gateway_item = by_id[str(gateway_main.id)]
        assert gateway_item["token_used_today"] is None
        assert gateway_item["token_limit_today"] is None
        assert gateway_item["token_remaining_today"] is None
        assert gateway_item["token_blocked"] is None
        assert gateway_item["token_reset_at"] is None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_agent_returns_blocked_token_state() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        usage_date_vn = SessionUsageSyncService.vn_usage_date()
        async with session_maker() as session:
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
            )
            board_agent = Agent(
                id=uuid4(),
                organization_id=org.id,
                board_id=board.id,
                gateway_id=gateway.id,
                name="Board Agent",
            )
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(board_agent)
            session.add(
                AgentTokenDailyUsage(
                    organization_id=org.id,
                    agent_id=board_agent.id,
                    usage_date_vn=usage_date_vn,
                    billed_tokens_used=16_000,
                    openclaw_tokens_total=32_000,
                    blocked_at=utcnow(),
                ),
            )
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get(f"/api/v1/agents/{board_agent.id}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["token_used_today"] == 16_000
        assert payload["token_limit_today"] == 5_000_000
        assert payload["token_remaining_today"] == 5_000_000 - 16_000
        assert payload["token_blocked"] is True
        assert isinstance(payload["token_reset_at"], str)
    finally:
        await engine.dispose()

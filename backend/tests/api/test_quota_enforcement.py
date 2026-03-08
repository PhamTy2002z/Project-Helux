# ruff: noqa: INP001
"""API-level quota enforcement tests for no-payment SaaS entitlements."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import boards as boards_api
from app.api.boards import router as boards_router
from app.api.deps import require_org_admin
from app.db.session import get_session
from app.models.gateways import Gateway
from app.models.organization_members import OrganizationMember
from app.models.organizations import Organization
from app.services.organizations import OrganizationContext


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


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


def _build_test_app(
    session_maker: async_sessionmaker[AsyncSession],
    *,
    ctx: OrganizationContext,
    gateway: Gateway,
) -> FastAPI:
    app = FastAPI()
    api_v1 = APIRouter(prefix="/api/v1")
    api_v1.include_router(boards_router)
    app.include_router(api_v1)

    async def _override_get_session() -> AsyncSession:
        async with session_maker() as session:
            yield session

    async def _override_require_org_admin() -> OrganizationContext:
        return ctx

    async def _override_gateway_for_create() -> Gateway:
        return gateway

    async def _override_group_for_create() -> None:
        return None

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[require_org_admin] = _override_require_org_admin
    app.dependency_overrides[boards_api._require_gateway_for_create] = _override_gateway_for_create
    app.dependency_overrides[
        boards_api._require_board_group_for_create
    ] = _override_group_for_create
    return app


@pytest.mark.asyncio
async def test_create_board_returns_429_when_quota_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        gateway = Gateway(
            id=uuid4(),
            organization_id=org.id,
            name="Gateway",
            url="https://gateway.example",
            workspace_root="/workspace/org",
        )

        async def _quota_raises(_session: AsyncSession, *, organization_id):
            _ = organization_id
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "quota_exceeded",
                    "resource": "boards",
                    "message": "boards quota exceeded",
                },
            )

        monkeypatch.setattr(boards_api, "enforce_board_quota", _quota_raises)

        app = _build_test_app(session_maker, ctx=_owner_ctx(org), gateway=gateway)
        payload = {
            "name": "Board",
            "slug": "board",
            "description": "Desc",
            "gateway_id": str(gateway.id),
        }
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post("/api/v1/boards", json=payload)

        assert response.status_code == 429
        detail = response.json().get("detail")
        assert detail["code"] == "quota_exceeded"
        assert detail["resource"] == "boards"
    finally:
        await engine.dispose()

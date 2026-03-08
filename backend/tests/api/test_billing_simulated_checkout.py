# ruff: noqa: INP001
"""Targeted API tests for simulated checkout success path."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.billing import router as billing_router
from app.api.deps import require_org_admin, require_org_member
from app.db.session import get_session
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
) -> FastAPI:
    app = FastAPI()
    api_v1 = APIRouter(prefix="/api/v1")
    api_v1.include_router(billing_router)
    app.include_router(api_v1)

    async def _override_get_session() -> AsyncSession:
        async with session_maker() as session:
            yield session

    async def _override_require_org_member() -> OrganizationContext:
        return ctx

    async def _override_require_org_admin() -> OrganizationContext:
        return ctx

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[require_org_member] = _override_require_org_member
    app.dependency_overrides[require_org_admin] = _override_require_org_admin
    return app


@pytest.mark.asyncio
async def test_simulated_checkout_unlocks_pro_plan() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        async with session_maker() as session:
            session.add(org)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        payload = {"plan_tier": "pro", "idempotency_key": "idem-checkout-1"}
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post("/api/v1/billing/simulate/checkout", json=payload)

        assert response.status_code == 200
        body = response.json()
        assert body["idempotent_replay"] is False
        assert body["subscription"]["plan_tier"] == "pro"
        assert body["subscription"]["status"] == "active"
    finally:
        await engine.dispose()

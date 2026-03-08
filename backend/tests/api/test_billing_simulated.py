# ruff: noqa: INP001
"""API tests for simulated billing checkout endpoints."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.billing import router as billing_router
from app.api.deps import require_org_admin, require_org_member
from app.core.config import settings
from app.core.time import utcnow
from app.db.session import get_session
from app.models.activity_events import ActivityEvent
from app.models.organization_members import OrganizationMember
from app.models.organization_plans import OrganizationPlan
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
async def test_simulated_checkout_is_idempotent() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        async with session_maker() as session:
            session.add(org)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        payload = {"plan_tier": "pro", "idempotency_key": "idem-123"}

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            first = await client.post("/api/v1/billing/simulate/checkout", json=payload)
            second = await client.post("/api/v1/billing/simulate/checkout", json=payload)

        assert first.status_code == 200
        assert second.status_code == 200
        first_body = first.json()
        second_body = second.json()
        assert first_body["checkout_id"] == second_body["checkout_id"]
        assert first_body["idempotent_replay"] is False
        assert second_body["idempotent_replay"] is True
        assert second_body["subscription"]["plan_tier"] == "pro"
        assert second_body["subscription"]["status"] == "active"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_subscription_returns_blocked_for_expired_trial() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        now = utcnow()
        expired_plan = OrganizationPlan(
            organization_id=org.id,
            tier="trial_7d",
            effective_from=now - timedelta(days=8),
            effective_until=now - timedelta(days=1),
            created_at=now - timedelta(days=8),
            updated_at=now - timedelta(days=1),
        )
        async with session_maker() as session:
            session.add(org)
            session.add(expired_plan)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/billing/me/subscription")

        assert response.status_code == 200
        body = response.json()
        assert body["plan_tier"] == "trial_7d"
        assert body["status"] == "blocked_for_payment"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_checkout_failure_emits_billing_failure_event() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        async with session_maker() as session:
            session.add(org)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        payload = {"plan_tier": "pro", "idempotency_key": "idem-failure-1"}
        original_mode = settings.billing_mode
        settings.billing_mode = "provider"
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                response = await client.post("/api/v1/billing/simulate/checkout", json=payload)
        finally:
            settings.billing_mode = original_mode

        assert response.status_code == 409
        async with session_maker() as session:
            events = await ActivityEvent.objects.filter_by(
                organization_id=org.id,
                event_type="saas.billing.simulated.checkout_failed",
            ).all(session)
        assert len(events) == 1
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_upgrade_modal_open_event_and_support_timeline() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        async with session_maker() as session:
            session.add(org)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            event_response = await client.post(
                "/api/v1/billing/events/upgrade-modal-open",
                json={"source": "sidebar"},
            )
        assert event_response.status_code == 200

        request_id = "req-12345678"
        async with session_maker() as session:
            session.add(
                ActivityEvent(
                    organization_id=org.id,
                    event_type="saas.billing.simulated.checkout_succeeded",
                    message=(
                        '{"request_id":"req-12345678","endpoint":"/api/v1/billing/simulate/checkout"}'
                    ),
                )
            )
            await session.commit()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            timeline_response = await client.get(
                f"/api/v1/billing/support/timeline?request_id={request_id}",
            )
        assert timeline_response.status_code == 200
        payload = timeline_response.json()
        assert payload
        assert payload[0]["request_id"] == request_id
    finally:
        await engine.dispose()

# ruff: noqa: INP001
"""API tests for onboarding progress state and event tracking."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import require_org_member
from app.api.onboarding_progress import router as onboarding_progress_router
from app.core.time import utcnow
from app.db.session import get_session
from app.models.activity_events import ActivityEvent
from app.models.board_onboarding import BoardOnboardingSession
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organization_members import OrganizationMember
from app.models.organizations import Organization
from app.services.organizations import OrganizationContext


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


def _member_ctx(org: Organization, *, user_id=None) -> OrganizationContext:
    resolved_user_id = user_id or uuid4()
    return OrganizationContext(
        organization=org,
        member=OrganizationMember(
            organization_id=org.id,
            user_id=resolved_user_id,
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
    api_v1.include_router(onboarding_progress_router)
    app.include_router(api_v1)

    async def _override_get_session() -> AsyncSession:
        async with session_maker() as session:
            yield session

    async def _override_require_org_member() -> OrganizationContext:
        return ctx

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[require_org_member] = _override_require_org_member
    return app


@pytest.mark.asyncio
async def test_get_progress_creates_default_steps() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        async with session_maker() as session:
            session.add(org)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_member_ctx(org))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.get("/api/v1/onboarding/progress/me")

        assert response.status_code == 200
        body = response.json()
        assert body["completed"] is False
        assert body["completion_pct"] == 0
        assert [step["key"] for step in body["steps"]] == [
            "use_case",
            "create_first_board",
            "run_onboarding_chat",
            "invite_teammate",
        ]
        assert all(step["status"] == "pending" for step in body["steps"])
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_progress_auto_completes_inferred_steps_and_tracks_events() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        org = Organization(id=uuid4(), name="Org")
        user_id = uuid4()
        now = utcnow()
        gateway = Gateway(
            id=uuid4(),
            organization_id=org.id,
            name="Gateway",
            url="https://gateway.example",
            workspace_root="/workspace/org",
            created_at=now - timedelta(minutes=2),
            updated_at=now - timedelta(minutes=2),
        )
        board = Board(
            id=uuid4(),
            organization_id=org.id,
            name="First Board",
            slug="first-board",
            description="onboarding",
            gateway_id=gateway.id,
            created_at=now - timedelta(minutes=1),
            updated_at=now - timedelta(minutes=1),
        )
        onboarding_session = BoardOnboardingSession(
            board_id=board.id,
            session_key="session-key-1",
            created_at=now - timedelta(seconds=45),
            updated_at=now - timedelta(seconds=45),
        )
        owner_member = OrganizationMember(
            organization_id=org.id,
            user_id=user_id,
            role="owner",
            all_boards_read=True,
            all_boards_write=True,
        )
        teammate_member = OrganizationMember(
            organization_id=org.id,
            user_id=uuid4(),
            role="member",
            all_boards_read=True,
            all_boards_write=False,
        )
        async with session_maker() as session:
            session.add(org)
            session.add(gateway)
            session.add(board)
            session.add(onboarding_session)
            session.add(owner_member)
            session.add(teammate_member)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_member_ctx(org, user_id=user_id))
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            patch_response = await client.patch(
                "/api/v1/onboarding/progress/me/steps",
                json={
                    "step": "use_case",
                    "action": "complete",
                    "details": {"use_case": "team-coordination"},
                },
            )
            assert patch_response.status_code == 200

            viewed_response = await client.post(
                "/api/v1/onboarding/progress/me/events/viewed",
                json={"step": "invite_teammate"},
            )
            assert viewed_response.status_code == 200

            response = await client.get("/api/v1/onboarding/progress/me")

        assert response.status_code == 200
        body = response.json()
        assert body["completed"] is True
        assert body["completion_pct"] == 100
        statuses = {step["key"]: step["status"] for step in body["steps"]}
        assert statuses["use_case"] == "completed"
        assert statuses["create_first_board"] == "completed"
        assert statuses["run_onboarding_chat"] == "completed"
        assert statuses["invite_teammate"] == "completed"

        async with session_maker() as session:
            events = (
                await ActivityEvent.objects.filter_by(organization_id=org.id)
                .order_by(ActivityEvent.created_at.asc())
                .all(session)
            )
        event_types = [event.event_type for event in events]
        assert "onboarding_step_completed" in event_types
        assert "onboarding_step_viewed" in event_types
    finally:
        await engine.dispose()

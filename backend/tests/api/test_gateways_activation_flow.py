# ruff: noqa: INP001
"""Gateway API tests for asynchronous activation enqueue flow."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi import APIRouter, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import require_org_admin
from app.api.gateways import router as gateways_router
from app.core.auth import AuthContext, get_auth_context
from app.core.auth_profile import AuthProfile
from app.db.session import get_session
from app.models.gateways import Gateway
from app.models.organization_members import OrganizationMember
from app.models.organizations import Organization
from app.models.users import User
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
    user: User,
) -> FastAPI:
    app = FastAPI()
    api_v1 = APIRouter(prefix="/api/v1")
    api_v1.include_router(gateways_router)
    app.include_router(api_v1)

    async def _override_get_session() -> AsyncSession:
        async with session_maker() as session:
            yield session

    async def _override_get_auth_context() -> AuthContext:
        return AuthContext(actor_type="user", user=user)

    async def _override_require_org_admin() -> OrganizationContext:
        return ctx

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_auth_context] = _override_get_auth_context
    app.dependency_overrides[require_org_admin] = _override_require_org_admin
    return app


def _owner_ctx(org: Organization, *, user_id: UUID) -> OrganizationContext:
    return OrganizationContext(
        organization=org,
        member=OrganizationMember(
            organization_id=org.id,
            user_id=user_id,
            role="owner",
            all_boards_read=True,
            all_boards_write=True,
        ),
    )


@pytest.mark.asyncio
async def test_create_gateway_enqueues_activation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.api.gateways.settings.auth_profile", AuthProfile.DEV)
    captured: list[tuple[str, str]] = []

    def _fake_enqueue(payload: object) -> bool:
        captured.append((str(payload.gateway_id), payload.action))  # type: ignore[attr-defined]
        return True

    monkeypatch.setattr("app.api.gateways.enqueue_gateway_activation", _fake_enqueue)

    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            org = Organization(id=uuid4(), name="Org")
            user = User(clerk_user_id="creator", email="creator@example.com")
            session.add(org)
            session.add(user)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org, user_id=user.id), user=user)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/gateways",
                json={
                    "name": "Primary",
                    "url": "ws://gateway.example:18789/ws",
                    "workspace_root": "/tmp/workspace",
                    "disable_device_pairing": False,
                    "allow_insecure_tls": False,
                },
            )
        assert response.status_code == 200
        payload = response.json()
        assert payload["activation_status"] == "activating"
        assert payload["activation_error"] is None
        assert captured and captured[0][1] == "provision"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_update_gateway_connection_change_enqueues_activation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.api.gateways.settings.auth_profile", AuthProfile.DEV)
    captured: list[tuple[str, str]] = []

    def _fake_enqueue(payload: object) -> bool:
        captured.append((str(payload.gateway_id), payload.action))  # type: ignore[attr-defined]
        return True

    monkeypatch.setattr("app.api.gateways.enqueue_gateway_activation", _fake_enqueue)

    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            org = Organization(id=uuid4(), name="Org")
            user = User(clerk_user_id="editor", email="editor@example.com")
            gateway = Gateway(
                id=uuid4(),
                organization_id=org.id,
                name="Primary",
                url="ws://gateway.example:18789/ws",
                workspace_root="/tmp/workspace",
                activation_status="ready",
            )
            session.add(org)
            session.add(user)
            session.add(gateway)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org, user_id=user.id), user=user)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.patch(
                f"/api/v1/gateways/{gateway.id}",
                json={"token": "new-token"},
            )
        assert response.status_code == 200
        payload = response.json()
        assert payload["activation_status"] == "activating"
        assert captured and captured[0][1] == "update"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_create_gateway_forbidden_in_saas_profile(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.api.gateways.settings.auth_profile", AuthProfile.SAAS)

    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            org = Organization(id=uuid4(), name="Org")
            user = User(clerk_user_id="creator_saas", email="creator@example.com")
            session.add(org)
            session.add(user)
            await session.commit()

        app = _build_test_app(session_maker, ctx=_owner_ctx(org, user_id=user.id), user=user)
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/gateways",
                json={
                    "name": "Primary",
                    "url": "ws://gateway.example:18789/ws",
                    "workspace_root": "/tmp/workspace",
                },
            )
        assert response.status_code == 403
        assert response.json().get("detail") == (
            "Gateway configuration is managed automatically in SaaS mode."
        )
    finally:
        await engine.dispose()

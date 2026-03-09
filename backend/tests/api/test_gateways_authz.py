# ruff: noqa: INP001
"""Authorization coverage for gateway session mutation endpoints."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi import APIRouter, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import require_org_admin
from app.api.gateway import router as gateway_router
from app.core.auth import AuthContext, get_auth_context
from app.db.session import get_session
from app.models.boards import Board
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
    api_v1.include_router(gateway_router)
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
async def test_send_gateway_session_message_rejects_cross_org_board(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            caller_org = Organization(id=uuid4(), name="Caller Org")
            foreign_org = Organization(id=uuid4(), name="Foreign Org")
            user = User(clerk_user_id="user_cross_org", email="cross@example.com")
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
            session.add(caller_org)
            session.add(foreign_org)
            session.add(user)
            session.add(foreign_gateway)
            session.add(foreign_board)
            await session.commit()

        sent_messages: list[str] = []

        async def _fake_send_message(
            content: str,
            *,
            session_key: str,
            config: object,
            deliver: bool = False,
        ) -> None:
            del session_key, config, deliver
            sent_messages.append(content)

        monkeypatch.setattr(
            "app.services.openclaw.session_service.send_message",
            _fake_send_message,
        )

        app = _build_test_app(
            session_maker,
            ctx=_owner_ctx(caller_org, user_id=user.id),
            user=user,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/gateways/sessions/session-demo/message",
                params={"board_id": str(foreign_board.id)},
                json={"content": "hello"},
            )

        assert response.status_code == 403
        assert sent_messages == []
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_send_gateway_session_message_allows_same_org_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            org = Organization(id=uuid4(), name="Org")
            user = User(clerk_user_id="user_same_org", email="same@example.com")
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
            member = OrganizationMember(
                organization_id=org.id,
                user_id=user.id,
                role="owner",
                all_boards_read=True,
                all_boards_write=True,
            )
            session.add(org)
            session.add(user)
            session.add(gateway)
            session.add(board)
            session.add(member)
            await session.commit()

        sent_messages: list[str] = []

        async def _fake_send_message(
            content: str,
            *,
            session_key: str,
            config: object,
            deliver: bool = False,
        ) -> None:
            del session_key, config, deliver
            sent_messages.append(content)

        monkeypatch.setattr(
            "app.services.openclaw.session_service.send_message",
            _fake_send_message,
        )

        app = _build_test_app(
            session_maker,
            ctx=_owner_ctx(org, user_id=user.id),
            user=user,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/gateways/sessions/session-demo/message",
                params={"board_id": str(board.id)},
                json={"content": "hello"},
            )

        assert response.status_code == 200
        assert response.json() == {"ok": True}
        assert sent_messages == ["hello"]
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_send_gateway_session_message_returns_429_on_agent_daily_quota(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with session_maker() as session:
            org = Organization(id=uuid4(), name="Org")
            user = User(clerk_user_id="user_quota", email="quota@example.com")
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
            member = OrganizationMember(
                organization_id=org.id,
                user_id=user.id,
                role="owner",
                all_boards_read=True,
                all_boards_write=True,
            )
            session.add(org)
            session.add(user)
            session.add(gateway)
            session.add(board)
            session.add(member)
            await session.commit()

        async def _fake_quota_sync(*_args: object, **_kwargs: object) -> None:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "quota_exceeded",
                    "resource": "agent_daily_tokens",
                    "message": "agent_daily_tokens quota exceeded",
                },
            )

        async def _fake_send_message(
            content: str,
            *,
            session_key: str,
            config: object,
            deliver: bool = False,
        ) -> None:
            _ = (content, session_key, config, deliver)
            raise AssertionError("send_message should not run after quota rejection")

        monkeypatch.setattr(
            "app.services.openclaw.session_service.AgentTokenQuotaService.sync_and_enforce",
            _fake_quota_sync,
        )
        monkeypatch.setattr(
            "app.services.openclaw.session_service.send_message",
            _fake_send_message,
        )

        app = _build_test_app(
            session_maker,
            ctx=_owner_ctx(org, user_id=user.id),
            user=user,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/api/v1/gateways/sessions/session-demo/message",
                params={"board_id": str(board.id)},
                json={"content": "hello"},
            )

        assert response.status_code == 429
        detail = response.json().get("detail")
        assert detail["code"] == "quota_exceeded"
        assert detail["resource"] == "agent_daily_tokens"
    finally:
        await engine.dispose()

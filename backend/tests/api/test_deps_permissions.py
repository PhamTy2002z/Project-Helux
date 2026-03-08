# ruff: noqa: INP001
"""Authorization dependency coverage for org-admin scoped resource checks."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import deps
from app.models.agents import Agent
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


def _org_ctx(organization: Organization, *, role: str) -> OrganizationContext:
    return OrganizationContext(
        organization=organization,
        member=OrganizationMember(
            organization_id=organization.id,
            user_id=uuid4(),
            role=role,
            all_boards_read=True,
            all_boards_write=True,
        ),
    )


@pytest.mark.asyncio
async def test_require_org_admin_rejects_non_admin_role() -> None:
    org = Organization(id=uuid4(), name="Org")
    ctx = _org_ctx(org, role="member")

    with pytest.raises(HTTPException) as exc_info:
        await deps.require_org_admin(ctx=ctx)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_agent_for_org_admin_rejects_cross_org_agent() -> None:
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
                url="https://gateway.foreign.example",
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

            with pytest.raises(HTTPException) as exc_info:
                await deps.get_agent_for_org_admin(
                    agent_id=foreign_agent.id,
                    session=session,
                    ctx=_org_ctx(caller_org, role="owner"),
                )

            assert exc_info.value.status_code == 404
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_get_agent_for_org_admin_allows_same_org_gateway_main_agent() -> None:
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
            main_agent = Agent(
                id=uuid4(),
                board_id=None,
                gateway_id=gateway.id,
                name="Main Agent",
            )
            session.add(org)
            session.add(gateway)
            session.add(main_agent)
            await session.commit()

            resolved = await deps.get_agent_for_org_admin(
                agent_id=main_agent.id,
                session=session,
                ctx=_org_ctx(org, role="owner"),
            )

            assert resolved.id == main_agent.id
    finally:
        await engine.dispose()

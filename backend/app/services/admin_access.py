"""Access control helpers for admin-only operations."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status

from app.models.boards import Board
from app.models.gateways import Gateway

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.core.auth import AuthContext
    from app.models.agents import Agent


def require_admin(auth: AuthContext) -> None:
    """Raise HTTP 403 unless the authenticated actor is a user admin."""
    if auth.actor_type != "user" or auth.user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)


async def resolve_agent_organization_id(
    *,
    session: AsyncSession,
    agent: Agent,
) -> UUID:
    """Resolve organization id for an agent via board/gateway ownership."""
    if agent.organization_id is not None:
        return agent.organization_id
    if agent.board_id is not None:
        board = await Board.objects.by_id(agent.board_id).first(session)
        if board is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
        return board.organization_id

    gateway = await Gateway.objects.by_id(agent.gateway_id).first(session)
    if gateway is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gateway not found")
    return gateway.organization_id


async def require_agent_in_organization(
    *,
    session: AsyncSession,
    agent: Agent,
    organization_id: UUID,
) -> None:
    """Require an agent to belong to the active organization context."""
    agent_org_id = await resolve_agent_organization_id(session=session, agent=agent)
    if agent_org_id != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

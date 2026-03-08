"""Tenant consistency checks for cross-reference validation."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agents import Agent
from app.models.tasks import Task


def tenant_error(*, code: str, message: str) -> HTTPException:
    """Build a standardized tenant invariant failure error."""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": code,
            "message": message,
        },
    )


async def require_agent_in_organization(
    session: AsyncSession,
    *,
    agent_id: UUID,
    organization_id: UUID,
) -> Agent:
    """Return an agent only when it belongs to the expected organization."""
    agent = await Agent.objects.by_id(agent_id).first(session)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if agent.organization_id is not None and agent.organization_id != organization_id:
        raise tenant_error(
            code="cross_org_agent_reference",
            message="Agent does not belong to the active organization.",
        )
    return agent


async def require_agent_in_board(
    session: AsyncSession,
    *,
    agent_id: UUID,
    board_id: UUID,
    organization_id: UUID,
) -> Agent:
    """Require that an agent belongs to both organization and board."""
    agent = await require_agent_in_organization(
        session,
        agent_id=agent_id,
        organization_id=organization_id,
    )
    if agent.board_id != board_id:
        raise tenant_error(
            code="cross_board_agent_reference",
            message="Agent does not belong to this board.",
        )
    return agent


async def require_tasks_in_board(
    session: AsyncSession,
    *,
    task_ids: Sequence[UUID],
    board_id: UUID,
    organization_id: UUID,
) -> None:
    """Validate that every task id is scoped to the expected board and organization."""
    normalized_task_ids = list(dict.fromkeys(task_ids))
    if not normalized_task_ids:
        return
    rows = list(
        await session.exec(
            select(col(Task.id))
            .where(col(Task.id).in_(normalized_task_ids))
            .where(col(Task.board_id) == board_id)
            .where(
                (col(Task.organization_id) == organization_id)
                | (col(Task.organization_id).is_(None))
            ),
        ),
    )
    found = {task_id for task_id in rows}
    missing = [task_id for task_id in normalized_task_ids if task_id not in found]
    if missing:
        raise tenant_error(
            code="cross_tenant_task_reference",
            message="One or more task references are outside the active board/org scope.",
        )

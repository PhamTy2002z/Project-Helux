"""Plan tier resolution and quota enforcement for no-payment SaaS mode."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import cast
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.time import utcnow
from app.models.agents import Agent
from app.models.boards import Board
from app.models.organization_plans import OrganizationPlan
from app.models.tasks import Task
from app.schemas.entitlements import (
    EntitlementUsageRead,
    OrganizationPlanAssign,
    PlanTier,
    QuotaUsage,
)


@dataclass(frozen=True, slots=True)
class EntitlementPolicy:
    """Static entitlement limits for a plan tier."""

    max_boards: int | None
    max_agents: int | None
    max_tasks_created_monthly: int | None


PLAN_POLICIES: dict[PlanTier, EntitlementPolicy] = {
    "free": EntitlementPolicy(max_boards=3, max_agents=10, max_tasks_created_monthly=500),
    "beta": EntitlementPolicy(max_boards=20, max_agents=100, max_tasks_created_monthly=5000),
    "pro": EntitlementPolicy(max_boards=200, max_agents=2000, max_tasks_created_monthly=50000),
}


def _coerce_plan_tier(value: str) -> PlanTier:
    if value in PLAN_POLICIES:
        return cast(PlanTier, value)
    return "free"


def policy_for_tier(tier: PlanTier) -> EntitlementPolicy:
    """Return immutable entitlement policy for a plan tier."""
    return PLAN_POLICIES[tier]


async def get_or_create_organization_plan(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> OrganizationPlan:
    """Load the org plan row, creating a default free-tier record when missing."""
    plan = await OrganizationPlan.objects.filter_by(organization_id=organization_id).first(session)
    if plan is not None:
        return plan
    now = utcnow()
    plan = OrganizationPlan(
        organization_id=organization_id,
        tier="free",
        effective_from=now,
        created_at=now,
        updated_at=now,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return plan


async def assign_organization_plan(
    session: AsyncSession,
    *,
    organization_id: UUID,
    payload: OrganizationPlanAssign,
) -> OrganizationPlan:
    """Create or update manual plan assignment for an organization."""
    plan = await OrganizationPlan.objects.filter_by(organization_id=organization_id).first(session)
    now = utcnow()
    if plan is None:
        plan = OrganizationPlan(
            organization_id=organization_id,
            tier=payload.tier,
            effective_from=payload.effective_from or now,
            effective_until=payload.effective_until,
            plan_metadata=payload.plan_metadata,
            created_at=now,
            updated_at=now,
        )
        session.add(plan)
    else:
        plan.tier = payload.tier
        if payload.effective_from is not None:
            plan.effective_from = payload.effective_from
        plan.effective_until = payload.effective_until
        plan.plan_metadata = payload.plan_metadata
        plan.updated_at = now
        session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return plan


async def _count_boards(session: AsyncSession, *, organization_id: UUID) -> int:
    statement = select(func.count(col(Board.id))).where(
        col(Board.organization_id) == organization_id
    )
    return int((await session.exec(statement)).one() or 0)


async def _count_agents(session: AsyncSession, *, organization_id: UUID) -> int:
    # Count board-scoped agents only. Gateway-main agents remain platform overhead.
    statement = (
        select(func.count(col(Agent.id)))
        .where(col(Agent.organization_id) == organization_id)
        .where(col(Agent.board_id).is_not(None))
    )
    return int((await session.exec(statement)).one() or 0)


async def _count_tasks_created_this_month(
    session: AsyncSession,
    *,
    organization_id: UUID,
    now: datetime,
) -> int:
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    statement = (
        select(func.count(col(Task.id)))
        .where(col(Task.organization_id) == organization_id)
        .where(col(Task.created_at) >= month_start)
    )
    return int((await session.exec(statement)).one() or 0)


def _usage_entry(*, resource: str, used: int, limit: int | None) -> QuotaUsage:
    remaining = None if limit is None else max(limit - used, 0)
    exceeded = limit is not None and used >= limit
    return QuotaUsage(
        resource=resource,
        used=used,
        limit=limit,
        remaining=remaining,
        exceeded=exceeded,
    )


async def get_entitlement_usage(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> EntitlementUsageRead:
    """Build full quota usage payload for API read surfaces."""
    now = utcnow()
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    tier = _coerce_plan_tier(plan.tier)
    policy = policy_for_tier(tier)

    boards_count = await _count_boards(session, organization_id=organization_id)
    agents_count = await _count_agents(session, organization_id=organization_id)
    tasks_created_count = await _count_tasks_created_this_month(
        session,
        organization_id=organization_id,
        now=now,
    )

    return EntitlementUsageRead(
        organization_id=organization_id,
        plan=tier,
        generated_at=now,
        quotas=[
            _usage_entry(resource="boards", used=boards_count, limit=policy.max_boards),
            _usage_entry(resource="agents", used=agents_count, limit=policy.max_agents),
            _usage_entry(
                resource="tasks_created_monthly",
                used=tasks_created_count,
                limit=policy.max_tasks_created_monthly,
            ),
        ],
    )


def _quota_exceeded_error(
    *,
    resource: str,
    tier: PlanTier,
    used: int,
    limit: int,
) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "quota_exceeded",
            "message": f"{resource} quota exceeded for plan '{tier}'.",
            "resource": resource,
            "plan": tier,
            "used": used,
            "limit": limit,
        },
    )


def _assert_usage_within_limit(
    *, resource: str, tier: PlanTier, used: int, limit: int | None
) -> None:
    if limit is None:
        return
    if used >= limit:
        raise _quota_exceeded_error(
            resource=resource,
            tier=tier,
            used=used,
            limit=limit,
        )


async def enforce_board_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject board creation when org has exhausted board quota."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    tier = _coerce_plan_tier(plan.tier)
    policy = policy_for_tier(tier)
    used = await _count_boards(session, organization_id=organization_id)
    _assert_usage_within_limit(resource="boards", tier=tier, used=used, limit=policy.max_boards)


async def enforce_agent_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject agent creation when org has exhausted agent quota."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    tier = _coerce_plan_tier(plan.tier)
    policy = policy_for_tier(tier)
    used = await _count_agents(session, organization_id=organization_id)
    _assert_usage_within_limit(resource="agents", tier=tier, used=used, limit=policy.max_agents)


async def enforce_task_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject task creation when monthly created-task quota is exhausted."""
    now = utcnow()
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    tier = _coerce_plan_tier(plan.tier)
    policy = policy_for_tier(tier)
    used = await _count_tasks_created_this_month(session, organization_id=organization_id, now=now)
    _assert_usage_within_limit(
        resource="tasks_created_monthly",
        tier=tier,
        used=used,
        limit=policy.max_tasks_created_monthly,
    )

"""Plan tier resolution and quota enforcement for SaaS billing mode."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.logging import get_request_endpoint, get_request_id
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.models.board_groups import BoardGroup
from app.models.boards import Board
from app.models.organization_plans import OrganizationPlan
from app.models.tasks import Task
from app.schemas.entitlements import (
    EntitlementUsageRead,
    OrganizationPlanAssign,
    PlanTier,
    QuotaUsage,
)
from app.services.activity_log import record_activity

TRIAL_DURATION_DAYS = 7


@dataclass(frozen=True, slots=True)
class EntitlementPolicy:
    """Static entitlement limits for a plan tier."""

    max_board_groups: int | None
    max_boards: int | None
    max_agents_total: int | None
    max_agents_per_board: int | None
    max_tasks_created_monthly: int | None
    org_daily_tokens: int | None
    agent_daily_tokens: int | None
    org_monthly_tokens: int | None
    trial_total_tokens: int | None
    max_tokens_per_run: int | None
    agent_daily_cost: Decimal | None = None
    org_daily_cost: Decimal | None = None


PLAN_POLICIES: dict[PlanTier, EntitlementPolicy] = {
    "trial_7d": EntitlementPolicy(
        max_board_groups=1,
        max_boards=1,
        max_agents_total=3,
        max_agents_per_board=3,
        max_tasks_created_monthly=None,
        org_daily_tokens=None,
        agent_daily_tokens=5_000_000,
        org_monthly_tokens=None,
        trial_total_tokens=20_000_000,
        max_tokens_per_run=8_000,
        agent_daily_cost=Decimal("2.50"),
        org_daily_cost=None,
    ),
    "pro": EntitlementPolicy(
        max_board_groups=2,
        max_boards=3,
        max_agents_total=15,
        max_agents_per_board=5,
        max_tasks_created_monthly=None,
        org_daily_tokens=None,
        agent_daily_tokens=20_000_000,
        org_monthly_tokens=200_000_000,
        trial_total_tokens=None,
        max_tokens_per_run=16_000,
        agent_daily_cost=Decimal("5.00"),
        org_daily_cost=None,
    ),
}


def coerce_plan_tier(value: str) -> PlanTier:
    # Keep legacy values forward-compatible while old rows are still around.
    if value in PLAN_POLICIES:
        return cast(PlanTier, value)
    if value in {"free", "beta"}:
        return "trial_7d"
    return "trial_7d"


def policy_for_tier(tier: PlanTier) -> EntitlementPolicy:
    """Return immutable entitlement policy for a plan tier."""
    return PLAN_POLICIES[tier]


def _trial_expired(*, tier: PlanTier, plan: OrganizationPlan, now: datetime) -> bool:
    if tier != "trial_7d":
        return False
    return plan.effective_until is not None and plan.effective_until <= now


def _payment_blocked_error(*, tier: PlanTier, effective_until: datetime | None) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "blocked_for_payment",
            "message": "Trial period has ended. Upgrade required to continue runtime actions.",
            "plan": tier,
            "effective_until": effective_until.isoformat() if effective_until else None,
        },
    )


def _default_trial_until(now: datetime) -> datetime:
    return now + timedelta(days=TRIAL_DURATION_DAYS)


async def get_or_create_organization_plan(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> OrganizationPlan:
    """Load the org plan row, creating a default trial-tier record when missing."""
    plan = await OrganizationPlan.objects.filter_by(organization_id=organization_id).first(session)
    if plan is not None:
        return plan
    now = utcnow()
    plan = OrganizationPlan(
        organization_id=organization_id,
        tier="trial_7d",
        effective_from=now,
        effective_until=_default_trial_until(now),
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
    effective_from = payload.effective_from or now
    effective_until = payload.effective_until
    if payload.tier == "trial_7d" and effective_until is None:
        effective_until = effective_from + timedelta(days=TRIAL_DURATION_DAYS)
    if payload.tier == "pro":
        effective_until = payload.effective_until
    if plan is None:
        plan = OrganizationPlan(
            organization_id=organization_id,
            tier=payload.tier,
            effective_from=effective_from,
            effective_until=effective_until,
            plan_metadata=payload.plan_metadata,
            created_at=now,
            updated_at=now,
        )
        session.add(plan)
    else:
        plan.tier = payload.tier
        plan.effective_from = effective_from
        plan.effective_until = effective_until
        plan.plan_metadata = payload.plan_metadata
        plan.updated_at = now
        session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return plan


async def _count_board_groups(session: AsyncSession, *, organization_id: UUID) -> int:
    statement = select(func.count(col(BoardGroup.id))).where(
        col(BoardGroup.organization_id) == organization_id
    )
    return int((await session.exec(statement)).one() or 0)


async def _count_boards(session: AsyncSession, *, organization_id: UUID) -> int:
    statement = select(func.count(col(Board.id))).where(
        col(Board.organization_id) == organization_id
    )
    return int((await session.exec(statement)).one() or 0)


async def _count_agents_total(session: AsyncSession, *, organization_id: UUID) -> int:
    # Count board-scoped agents only. Gateway-main agents remain platform overhead.
    statement = (
        select(func.count(col(Agent.id)))
        .where(col(Agent.organization_id) == organization_id)
        .where(col(Agent.board_id).is_not(None))
    )
    return int((await session.exec(statement)).one() or 0)


async def _count_agents_for_board(
    session: AsyncSession,
    *,
    organization_id: UUID,
    board_id: UUID,
) -> int:
    statement = (
        select(func.count(col(Agent.id)))
        .where(col(Agent.organization_id) == organization_id)
        .where(col(Agent.board_id) == board_id)
    )
    return int((await session.exec(statement)).one() or 0)


async def _max_agents_on_single_board(session: AsyncSession, *, organization_id: UUID) -> int:
    statement = (
        select(func.count(col(Agent.id)))
        .where(col(Agent.organization_id) == organization_id)
        .where(col(Agent.board_id).is_not(None))
        .group_by(col(Agent.board_id))
    )
    values = [int(value or 0) for value in (await session.exec(statement)).all()]
    if not values:
        return 0
    return max(values)


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


def _token_usage_from_metadata(plan: OrganizationPlan) -> dict[str, int]:
    if not isinstance(plan.plan_metadata, dict):
        return {}
    raw_usage = plan.plan_metadata.get("token_usage")
    if not isinstance(raw_usage, dict):
        return {}
    values: dict[str, int] = {}
    for key in ("org_daily", "agent_daily", "org_monthly", "trial_total"):
        raw = raw_usage.get(key)
        if isinstance(raw, int):
            values[key] = max(raw, 0)
    return values


def _vn_date_from_utc(value: datetime) -> date:
    aware_utc = value if value.tzinfo else value.replace(tzinfo=UTC)
    return aware_utc.astimezone(ZoneInfo(settings.openclaw_usage_day_timezone)).date()


def _next_month_start(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def _coerce_int(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float, Decimal)):
        return int(value)
    if isinstance(value, str):
        with_value = value.strip()
        if not with_value:
            return 0
        try:
            return int(with_value)
        except ValueError:
            return 0
    return 0


def _coerce_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    if isinstance(value, str):
        with_value = value.strip()
        if not with_value:
            return 0.0
        try:
            return float(with_value)
        except ValueError:
            return 0.0
    return 0.0


async def _token_usage_from_ledger(
    session: AsyncSession,
    *,
    organization_id: UUID,
    now: datetime,
) -> tuple[dict[str, float], bool]:
    today_vn = _vn_date_from_utc(now)
    month_start_vn = today_vn.replace(day=1)
    next_month_start_vn = _next_month_start(month_start_vn)
    usage_date_col = col(AgentTokenDailyUsage.usage_date_vn)
    billed_col = col(AgentTokenDailyUsage.billed_tokens_used)
    cost_col = col(AgentTokenDailyUsage.cost_used)

    statement = select(  # type: ignore[call-overload]
        func.count(col(AgentTokenDailyUsage.id)),
        func.coalesce(
            func.sum(
                case((usage_date_col == today_vn, billed_col), else_=0),
            ),
            0,
        ),
        func.coalesce(
            func.max(
                case((usage_date_col == today_vn, billed_col), else_=None),
            ),
            0,
        ),
        func.coalesce(
            func.sum(
                case(
                    (
                        (usage_date_col >= month_start_vn) & (usage_date_col < next_month_start_vn),
                        billed_col,
                    ),
                    else_=0,
                ),
            ),
            0,
        ),
        func.coalesce(func.sum(billed_col), 0),
        # Cost aggregation: org daily cost, agent max daily cost
        func.coalesce(
            func.sum(
                case((usage_date_col == today_vn, cost_col), else_=0),
            ),
            0,
        ),
        func.coalesce(
            func.max(
                case((usage_date_col == today_vn, cost_col), else_=None),
            ),
            0,
        ),
    ).where(col(AgentTokenDailyUsage.organization_id) == organization_id)
    row = cast(
        tuple[object, object, object, object, object, object, object],
        (await session.exec(statement)).one(),
    )
    ledger_rows = _coerce_int(row[0])
    if ledger_rows <= 0:
        return {}, False
    return (
        {
            "org_daily": max(_coerce_int(row[1]), 0),
            "agent_daily": max(_coerce_int(row[2]), 0),
            "org_monthly": max(_coerce_int(row[3]), 0),
            "trial_total": max(_coerce_int(row[4]), 0),
            "org_daily_cost": max(_coerce_float(row[5]), 0.0),
            "agent_daily_cost": max(_coerce_float(row[6]), 0.0),
        },
        True,
    )


def _usage_entry(*, resource: str, used: float, limit: float | None) -> QuotaUsage:
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
    tier = coerce_plan_tier(plan.tier)
    policy = policy_for_tier(tier)

    board_groups_count = await _count_board_groups(session, organization_id=organization_id)
    boards_count = await _count_boards(session, organization_id=organization_id)
    agents_total_count = await _count_agents_total(session, organization_id=organization_id)
    agents_per_board_max_used = await _max_agents_on_single_board(
        session, organization_id=organization_id
    )
    tasks_created_count = await _count_tasks_created_this_month(
        session,
        organization_id=organization_id,
        now=now,
    )
    metadata_token_usage = _token_usage_from_metadata(plan)
    ledger_token_usage, ledger_has_rows = await _token_usage_from_ledger(
        session,
        organization_id=organization_id,
        now=now,
    )
    token_usage = ledger_token_usage if ledger_has_rows else metadata_token_usage

    quotas = [
        _usage_entry(
            resource="board_groups", used=board_groups_count, limit=policy.max_board_groups
        ),
        _usage_entry(resource="boards", used=boards_count, limit=policy.max_boards),
        _usage_entry(
            resource="agents_total", used=agents_total_count, limit=policy.max_agents_total
        ),
        _usage_entry(
            resource="agents_per_board",
            used=agents_per_board_max_used,
            limit=policy.max_agents_per_board,
        ),
        _usage_entry(
            resource="tasks_created_monthly",
            used=tasks_created_count,
            limit=policy.max_tasks_created_monthly,
        ),
        _usage_entry(
            resource="org_daily_tokens",
            used=token_usage.get("org_daily", 0),
            limit=policy.org_daily_tokens,
        ),
        _usage_entry(
            resource="agent_daily_tokens",
            used=token_usage.get("agent_daily", 0),
            limit=policy.agent_daily_tokens,
        ),
        _usage_entry(
            resource="org_monthly_tokens",
            used=token_usage.get("org_monthly", 0),
            limit=policy.org_monthly_tokens,
        ),
        _usage_entry(
            resource="trial_total_tokens",
            used=token_usage.get("trial_total", 0),
            limit=policy.trial_total_tokens,
        ),
        _usage_entry(resource="max_tokens_per_run", used=0, limit=policy.max_tokens_per_run),
        _usage_entry(
            resource="agent_daily_cost",
            used=token_usage.get("agent_daily_cost", 0.0),
            limit=float(policy.agent_daily_cost) if policy.agent_daily_cost is not None else None,
        ),
        _usage_entry(
            resource="org_daily_cost",
            used=token_usage.get("org_daily_cost", 0.0),
            limit=float(policy.org_daily_cost) if policy.org_daily_cost is not None else None,
        ),
    ]

    return EntitlementUsageRead(
        organization_id=organization_id,
        plan=tier,
        generated_at=now,
        quotas=quotas,
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
    *,
    resource: str,
    tier: PlanTier,
    used: int,
    limit: int | None,
    include_limit: int = 0,
) -> None:
    if limit is None:
        return
    if used + include_limit >= limit:
        raise _quota_exceeded_error(
            resource=resource,
            tier=tier,
            used=used,
            limit=limit,
        )


async def _resolve_policy_for_runtime(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> tuple[PlanTier, EntitlementPolicy]:
    now = utcnow()
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    tier = coerce_plan_tier(plan.tier)
    if _trial_expired(tier=tier, plan=plan, now=now):
        payload = {
            "request_id": get_request_id(),
            "endpoint": get_request_endpoint(),
            "plan": tier,
            "effective_until": plan.effective_until.isoformat() if plan.effective_until else None,
        }
        record_activity(
            session,
            event_type="saas.trial.expired.blocked",
            organization_id=organization_id,
            message=json.dumps(payload, separators=(",", ":"), sort_keys=True),
        )
        await session.commit()
        raise _payment_blocked_error(tier=tier, effective_until=plan.effective_until)
    return tier, policy_for_tier(tier)


async def resolve_runtime_policy(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> tuple[PlanTier, EntitlementPolicy]:
    """Resolve active plan tier and policy, including trial-expiry blocking rules."""
    return await _resolve_policy_for_runtime(session, organization_id=organization_id)


async def enforce_board_group_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject board-group creation when org has exhausted board-group quota."""
    tier, policy = await _resolve_policy_for_runtime(session, organization_id=organization_id)
    used = await _count_board_groups(session, organization_id=organization_id)
    _assert_usage_within_limit(
        resource="board_groups",
        tier=tier,
        used=used,
        limit=policy.max_board_groups,
    )


async def enforce_board_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject board creation when org has exhausted board quota."""
    tier, policy = await _resolve_policy_for_runtime(session, organization_id=organization_id)
    used = await _count_boards(session, organization_id=organization_id)
    _assert_usage_within_limit(resource="boards", tier=tier, used=used, limit=policy.max_boards)


async def enforce_agent_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject agent creation when org has exhausted total agent quota."""
    tier, policy = await _resolve_policy_for_runtime(session, organization_id=organization_id)
    used = await _count_agents_total(session, organization_id=organization_id)
    _assert_usage_within_limit(
        resource="agents_total",
        tier=tier,
        used=used,
        limit=policy.max_agents_total,
    )


async def enforce_agents_per_board_quota(
    session: AsyncSession,
    *,
    organization_id: UUID,
    board_id: UUID,
) -> None:
    """Reject agent creation when board has exhausted per-board agent quota."""
    tier, policy = await _resolve_policy_for_runtime(session, organization_id=organization_id)
    used = await _count_agents_for_board(
        session,
        organization_id=organization_id,
        board_id=board_id,
    )
    _assert_usage_within_limit(
        resource="agents_per_board",
        tier=tier,
        used=used,
        limit=policy.max_agents_per_board,
    )


async def enforce_task_quota(session: AsyncSession, *, organization_id: UUID) -> None:
    """Reject runtime actions when trial has expired; keep room for future task limits."""
    tier, policy = await _resolve_policy_for_runtime(session, organization_id=organization_id)
    if policy.max_tasks_created_monthly is None:
        return
    now = utcnow()
    used = await _count_tasks_created_this_month(session, organization_id=organization_id, now=now)
    _assert_usage_within_limit(
        resource="tasks_created_monthly",
        tier=tier,
        used=used,
        limit=policy.max_tasks_created_monthly,
    )

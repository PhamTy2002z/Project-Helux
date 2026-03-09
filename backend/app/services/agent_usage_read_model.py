"""Read-model helpers for agent token usage fields on API surfaces."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import TYPE_CHECKING
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlmodel import col, select

from app.core.config import settings
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.services.entitlements import (
    coerce_plan_tier,
    get_or_create_organization_plan,
    policy_for_tier,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlmodel.ext.asyncio.session import AsyncSession


@dataclass(frozen=True, slots=True)
class AgentTokenUsageSnapshot:
    """Computed per-agent token usage fields for one VN-local day."""

    used_today: int
    limit_today: int | None
    remaining_today: int | None
    blocked: bool
    reset_at: datetime


class AgentTokenUsageReadModel:
    """Build usage snapshots used by agent read APIs."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _vn_today(*, now: datetime | None = None) -> date:
        source = now or utcnow()
        aware_utc = source if source.tzinfo else source.replace(tzinfo=UTC)
        return aware_utc.astimezone(ZoneInfo(settings.openclaw_usage_day_timezone)).date()

    @classmethod
    def _next_vn_midnight(cls, *, now: datetime | None = None) -> datetime:
        today_vn = cls._vn_today(now=now)
        midnight_next_vn = datetime.combine(today_vn + timedelta(days=1), time.min).replace(
            tzinfo=ZoneInfo(settings.openclaw_usage_day_timezone),
        )
        return midnight_next_vn.astimezone(UTC)

    async def _resolve_agent_daily_limit(self, *, organization_id: UUID) -> int | None:
        plan = await get_or_create_organization_plan(self.session, organization_id=organization_id)
        tier = coerce_plan_tier(plan.tier)
        policy = policy_for_tier(tier)
        return policy.agent_daily_tokens

    async def _fetch_usage_rows(
        self,
        *,
        organization_id: UUID,
        usage_date_vn: date,
        agent_ids: Sequence[UUID],
    ) -> dict[UUID, AgentTokenDailyUsage]:
        if not agent_ids:
            return {}
        rows = list(
            await self.session.exec(
                select(AgentTokenDailyUsage)
                .where(col(AgentTokenDailyUsage.organization_id) == organization_id)
                .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date_vn)
                .where(col(AgentTokenDailyUsage.agent_id).in_(agent_ids)),
            ),
        )
        return {row.agent_id: row for row in rows}

    async def snapshot_for_agent(
        self,
        *,
        organization_id: UUID,
        agent: Agent,
    ) -> AgentTokenUsageSnapshot | None:
        if agent.board_id is None:
            return None
        snapshots = await self.snapshots_for_agents(organization_id=organization_id, agents=[agent])
        return snapshots.get(agent.id)

    async def snapshots_for_agents(
        self,
        *,
        organization_id: UUID,
        agents: Sequence[Agent],
    ) -> dict[UUID, AgentTokenUsageSnapshot]:
        board_scoped_agents = [agent for agent in agents if agent.board_id is not None]
        if not board_scoped_agents:
            return {}

        usage_date_vn = self._vn_today()
        reset_at = self._next_vn_midnight()
        limit_today = await self._resolve_agent_daily_limit(organization_id=organization_id)
        rows_by_agent = await self._fetch_usage_rows(
            organization_id=organization_id,
            usage_date_vn=usage_date_vn,
            agent_ids=[agent.id for agent in board_scoped_agents],
        )

        snapshots: dict[UUID, AgentTokenUsageSnapshot] = {}
        for agent in board_scoped_agents:
            row = rows_by_agent.get(agent.id)
            used_today = max(int(row.billed_tokens_used), 0) if row is not None else 0
            remaining_today = max(limit_today - used_today, 0) if limit_today is not None else None
            blocked = bool(row and row.blocked_at is not None)
            snapshots[agent.id] = AgentTokenUsageSnapshot(
                used_today=used_today,
                limit_today=limit_today,
                remaining_today=remaining_today,
                blocked=blocked,
                reset_at=reset_at,
            )
        return snapshots

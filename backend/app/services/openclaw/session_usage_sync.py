"""Session usage sync helpers for per-agent quota accounting."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlmodel import col, select

from app.core.config import settings
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.services.openclaw.db_service import OpenClawDBService
from app.services.openclaw.gateway_rpc import GatewayConfig
from app.services.openclaw.usage_client import SessionUsageQuery, fetch_session_usage

_BILLING_MULTIPLIER = 0.5


@dataclass(frozen=True, slots=True)
class SessionUsageSyncResult:
    """Result of one session usage sync into the local daily ledger."""

    agent_id: str
    organization_id: str
    usage_date_vn: date
    openclaw_total: int
    openclaw_delta: int
    billed_delta: int
    billed_total: int


class SessionUsageSyncService(OpenClawDBService):
    """Sync OpenClaw `sessions.usage` totals into `agent_token_daily_usage` rows."""

    @staticmethod
    def vn_usage_date(*, value: datetime | None = None) -> date:
        source = value or utcnow()
        aware_utc = source.replace(tzinfo=UTC)
        return aware_utc.astimezone(ZoneInfo(settings.openclaw_usage_day_timezone)).date()

    @staticmethod
    def usage_date_range(usage_date_vn: date) -> tuple[str, str]:
        value = usage_date_vn.isoformat()
        return value, value

    async def resolve_board_scoped_agent(
        self,
        *,
        session_key: str,
        organization_id: object | None = None,
    ) -> Agent | None:
        normalized_key = session_key.strip()
        if not normalized_key:
            return None
        statement = (
            select(Agent)
            .where(col(Agent.openclaw_session_id) == normalized_key)
            .where(col(Agent.board_id).is_not(None))
        )
        if organization_id is not None:
            statement = statement.where(col(Agent.organization_id) == organization_id)
        agents = list(await self.session.exec(statement))
        if not agents:
            return None
        if organization_id is None and len({agent.organization_id for agent in agents}) > 1:
            self.logger.warning(
                "usage.sync.agent_resolution_ambiguous session_key=%s matches=%s",
                normalized_key,
                len(agents),
            )
            return None
        return agents[0]

    async def _ensure_daily_row(
        self,
        *,
        organization_id: object,
        agent_id: object,
        usage_date_vn: date,
    ) -> None:
        bind = self.session.get_bind()
        dialect_name = bind.dialect.name if bind is not None else ""
        now = utcnow()
        values = {
            "id": uuid4(),
            "organization_id": organization_id,
            "agent_id": agent_id,
            "usage_date_vn": usage_date_vn,
            "openclaw_tokens_total": 0,
            "billed_tokens_used": 0,
            "created_at": now,
            "updated_at": now,
        }
        if dialect_name == "postgresql":
            statement = postgres_insert(AgentTokenDailyUsage).values(**values)
            statement = statement.on_conflict_do_nothing(
                index_elements=["agent_id", "usage_date_vn"],
            )
            await self.session.exec(statement)
            await self.session.flush()
            return
        if dialect_name == "sqlite":
            statement = sqlite_insert(AgentTokenDailyUsage).values(**values)
            statement = statement.on_conflict_do_nothing(
                index_elements=["agent_id", "usage_date_vn"],
            )
            await self.session.exec(statement)
            await self.session.flush()
            return

        row = (
            await self.session.exec(
                select(AgentTokenDailyUsage)
                .where(col(AgentTokenDailyUsage.agent_id) == agent_id)
                .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date_vn),
            )
        ).first()
        if row is None:
            self.session.add(
                AgentTokenDailyUsage(
                    organization_id=organization_id,
                    agent_id=agent_id,
                    usage_date_vn=usage_date_vn,
                    created_at=now,
                    updated_at=now,
                ),
            )
            await self.session.flush()

    async def sync_session_usage(
        self,
        *,
        agent: Agent,
        config: GatewayConfig,
        usage_date_vn: date | None = None,
    ) -> SessionUsageSyncResult:
        session_key = (agent.openclaw_session_id or "").strip()
        if not session_key:
            raise ValueError("agent session key is required for usage sync")
        if agent.organization_id is None:
            raise ValueError("agent organization_id is required for usage sync")

        usage_date = usage_date_vn or self.vn_usage_date()
        start_date, end_date = self.usage_date_range(usage_date)
        usage = await fetch_session_usage(
            config=config,
            query=SessionUsageQuery(
                session_key=session_key,
                start_date=start_date,
                end_date=end_date,
                mode="specific",
                utc_offset=settings.openclaw_usage_utc_offset,
            ),
        )

        await self._ensure_daily_row(
            organization_id=agent.organization_id,
            agent_id=agent.id,
            usage_date_vn=usage_date,
        )
        statement = (
            select(AgentTokenDailyUsage)
            .where(col(AgentTokenDailyUsage.organization_id) == agent.organization_id)
            .where(col(AgentTokenDailyUsage.agent_id) == agent.id)
            .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date)
        )
        bind = self.session.get_bind()
        if bind is not None and bind.dialect.name != "sqlite":
            statement = statement.with_for_update()
        row = (await self.session.exec(statement)).first()
        if row is None:
            raise RuntimeError("failed to lock usage ledger row")

        previous_openclaw_total = max(int(row.openclaw_tokens_total), 0)
        next_openclaw_total = max(int(usage.total_tokens), 0)
        openclaw_delta = max(next_openclaw_total - previous_openclaw_total, 0)
        billed_delta = int(math.ceil(openclaw_delta * _BILLING_MULTIPLIER))

        # The first sync of a day should establish a baseline and avoid charging
        # historical tokens that may have accumulated before Mission Control
        # started tracking this session/day locally.
        if int(row.openclaw_tokens_total) <= 0 and int(row.billed_tokens_used) <= 0:
            openclaw_delta = 0
            billed_delta = 0

        row.openclaw_tokens_total = max(previous_openclaw_total, next_openclaw_total)
        row.billed_tokens_used = max(int(row.billed_tokens_used), 0) + billed_delta
        row.last_synced_at = utcnow()
        row.updated_at = utcnow()
        self.session.add(row)
        await self.session.flush()

        return SessionUsageSyncResult(
            agent_id=str(agent.id),
            organization_id=str(agent.organization_id),
            usage_date_vn=usage_date,
            openclaw_total=row.openclaw_tokens_total,
            openclaw_delta=openclaw_delta,
            billed_delta=billed_delta,
            billed_total=row.billed_tokens_used,
        )

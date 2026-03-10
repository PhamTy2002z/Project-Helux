"""Per-agent OpenClaw usage sync and daily 2-layer quota enforcement."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import col, select

from app.core.config import settings
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
from app.models.agents import Agent
from app.services.entitlements import resolve_runtime_policy
from app.services.openclaw.db_service import OpenClawDBService
from app.services.openclaw.gateway_compat import check_gateway_sessions_usage_capability
from app.services.openclaw.gateway_rpc import GatewayConfig, OpenClawGatewayError
from app.services.openclaw.session_usage_sync import SessionUsageSyncResult, SessionUsageSyncService
from app.services.openclaw.usage_client import (
    OpenClawUsagePayloadError,
    OpenClawUsageUnsupportedError,
)

_ERR_GATEWAY_USAGE_UNSUPPORTED = "gateway_sessions_usage_unsupported"
_ERR_GATEWAY_USAGE_SYNC_FAILED = "gateway_sessions_usage_sync_failed"
_ERR_GATEWAY_USAGE_PAYLOAD_INVALID = "gateway_sessions_usage_payload_invalid"


@dataclass(frozen=True, slots=True)
class AgentQuotaSyncOutcome:
    """Result of one sync-and-enforce pass for a board-scoped agent."""

    agent_id: UUID
    organization_id: UUID
    billed_total: int
    billed_delta: int
    token_limit: int | None
    cost_total: Decimal = Decimal(0)
    cost_delta: Decimal = Decimal(0)
    cost_limit: Decimal | None = None
    quota_reached: bool = False
    blocked_by: str | None = None

    @property
    def limit(self) -> int | None:
        """Backward-compatible alias for token_limit."""
        return self.token_limit


class AgentTokenQuotaService(OpenClawDBService):
    """Sync OpenClaw usage into ledger and enforce agent daily caps."""

    @staticmethod
    def _enforce_mode_enabled() -> bool:
        return settings.openclaw_usage_enforcement_mode == "enforce"

    def _capability_failure(self, *, code: str, message: str) -> None:
        if not self._enforce_mode_enabled():
            self.logger.warning(
                "agent.quota.observe_mode.skip code=%s message=%s",
                code,
                message,
            )
            return
        self.logger.warning(
            "agent.quota.sync_failed code=%s message=%s",
            code,
            message,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": code,
                "message": message,
            },
        )

    async def _mark_blocked_if_needed(
        self,
        *,
        organization_id: UUID,
        agent_id: UUID,
        usage_date_vn: object,
        resource: str,
    ) -> None:
        row = (
            await self.session.exec(
                select(AgentTokenDailyUsage)
                .where(col(AgentTokenDailyUsage.organization_id) == organization_id)
                .where(col(AgentTokenDailyUsage.agent_id) == agent_id)
                .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date_vn),
            )
        ).first()
        if row is None:
            return
        now = utcnow()
        if resource == "agent_daily_cost" and row.cost_blocked_at is None:
            row.cost_blocked_at = now
            row.updated_at = now
            self.session.add(row)
            await self.session.flush()
        elif resource == "agent_daily_tokens" and row.blocked_at is None:
            row.blocked_at = now
            row.updated_at = now
            self.session.add(row)
            await self.session.flush()

    async def _all_board_members_blocked(
        self,
        *,
        board_id: object,
        organization_id: UUID,
        usage_date_vn: object,
    ) -> bool:
        """Check if every non-lead agent on the board is blocked today."""
        members = (
            await self.session.exec(
                select(Agent)
                .where(col(Agent.board_id) == board_id)
                .where(col(Agent.organization_id) == organization_id)
                .where(col(Agent.is_board_lead) == False)  # noqa: E712
                .where(col(Agent.is_gateway_main) == False)  # noqa: E712
            )
        ).all()
        if not members:
            return False
        member_ids = [m.id for m in members]
        rows = (
            await self.session.exec(
                select(AgentTokenDailyUsage)
                .where(col(AgentTokenDailyUsage.agent_id).in_(member_ids))
                .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date_vn)
            )
        ).all()
        blocked_by_id = {
            row.agent_id
            for row in rows
            if row.blocked_at is not None or row.cost_blocked_at is not None
        }
        return all(m.id in blocked_by_id for m in members)

    async def sync_and_enforce(
        self,
        *,
        session_key: str,
        organization_id: UUID,
        config: GatewayConfig,
    ) -> AgentQuotaSyncOutcome | None:
        sync_service = SessionUsageSyncService(self.session)
        agent = await sync_service.resolve_board_scoped_agent(
            session_key=session_key,
            organization_id=organization_id,
        )
        if agent is None:
            return None
        # Board leads track usage but never get blocked (observe-only).
        is_lead = bool(agent.is_board_lead)

        capability = await check_gateway_sessions_usage_capability(config)
        if not capability.supported:
            self._capability_failure(
                code=capability.code or _ERR_GATEWAY_USAGE_UNSUPPORTED,
                message=capability.message
                or "Gateway runtime does not support OpenClaw sessions.usage.",
            )
            return None

        sync_result: SessionUsageSyncResult
        try:
            sync_result = await sync_service.sync_session_usage(
                agent=agent,
                config=config,
            )
        except OpenClawUsageUnsupportedError:
            self._capability_failure(
                code=_ERR_GATEWAY_USAGE_UNSUPPORTED,
                message="Gateway runtime does not support OpenClaw sessions.usage.",
            )
            return None
        except OpenClawUsagePayloadError as exc:
            self._capability_failure(
                code=_ERR_GATEWAY_USAGE_PAYLOAD_INVALID,
                message=f"Unable to parse OpenClaw usage payload: {exc}",
            )
            return None
        except OpenClawGatewayError as exc:
            self._capability_failure(
                code=_ERR_GATEWAY_USAGE_SYNC_FAILED,
                message=f"OpenClaw usage sync failed: {exc}",
            )
            return None

        tier, policy = await resolve_runtime_policy(
            self.session,
            organization_id=organization_id,
        )

        token_limit = policy.agent_daily_tokens
        cost_limit = policy.agent_daily_cost

        # Layer 1: Cost quota (primary, when cost data available)
        cost_exceeded = (
            sync_result.cost_data_available
            and cost_limit is not None
            and sync_result.cost_total >= cost_limit
        )

        # Layer 2: Token hard-cap (safety net, always checked)
        token_exceeded = token_limit is not None and sync_result.billed_total >= token_limit

        blocked_by: str | None = None
        if cost_exceeded:
            blocked_by = "agent_daily_cost"
        elif token_exceeded:
            blocked_by = "agent_daily_tokens"

        if blocked_by is not None:
            if not self._enforce_mode_enabled():
                self.logger.warning(
                    "agent.quota.observe_mode.quota_reached agent_id=%s resource=%s used_cost=%s used_tokens=%s",
                    agent.id,
                    blocked_by,
                    sync_result.cost_total,
                    sync_result.billed_total,
                )
                return AgentQuotaSyncOutcome(
                    agent_id=agent.id,
                    organization_id=organization_id,
                    billed_total=sync_result.billed_total,
                    billed_delta=sync_result.billed_delta,
                    token_limit=token_limit,
                    cost_total=sync_result.cost_total,
                    cost_delta=sync_result.cost_delta,
                    cost_limit=cost_limit,
                    quota_reached=True,
                    blocked_by=blocked_by,
                )
            # Board lead exempt from quota unless all members are blocked
            if is_lead:
                all_members_down = await self._all_board_members_blocked(
                    board_id=agent.board_id,
                    organization_id=organization_id,
                    usage_date_vn=sync_result.usage_date_vn,
                )
                if not all_members_down:
                    self.logger.info(
                        "agent.quota.board_lead.exempt agent_id=%s resource=%s",
                        agent.id,
                        blocked_by,
                    )
                    return AgentQuotaSyncOutcome(
                        agent_id=agent.id,
                        organization_id=organization_id,
                        billed_total=sync_result.billed_total,
                        billed_delta=sync_result.billed_delta,
                        token_limit=token_limit,
                        cost_total=sync_result.cost_total,
                        cost_delta=sync_result.cost_delta,
                        cost_limit=cost_limit,
                        quota_reached=True,
                        blocked_by=blocked_by,
                    )
                self.logger.warning(
                    "agent.quota.board_lead.all_members_blocked agent_id=%s resource=%s",
                    agent.id,
                    blocked_by,
                )
            await self._mark_blocked_if_needed(
                organization_id=organization_id,
                agent_id=agent.id,
                usage_date_vn=sync_result.usage_date_vn,
                resource=blocked_by,
            )
            self.logger.warning(
                "agent.quota.blocked agent_id=%s resource=%s cost=%s tokens=%s",
                agent.id,
                blocked_by,
                sync_result.cost_total,
                sync_result.billed_total,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "quota_exceeded",
                    "message": f"{blocked_by} quota exceeded for current plan.",
                    "resource": blocked_by,
                    "plan": tier,
                    "cost_used": str(sync_result.cost_total),
                    "cost_limit": str(cost_limit) if cost_limit else None,
                    "token_used": sync_result.billed_total,
                    "token_limit": token_limit,
                    "agent_id": str(agent.id),
                    "usage_date_vn": sync_result.usage_date_vn.isoformat(),
                },
            )

        return AgentQuotaSyncOutcome(
            agent_id=agent.id,
            organization_id=organization_id,
            billed_total=sync_result.billed_total,
            billed_delta=sync_result.billed_delta,
            token_limit=token_limit,
            cost_total=sync_result.cost_total,
            cost_delta=sync_result.cost_delta,
            cost_limit=cost_limit,
            quota_reached=False,
        )

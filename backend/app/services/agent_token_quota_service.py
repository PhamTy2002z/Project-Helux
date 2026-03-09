"""Per-agent OpenClaw usage sync and daily token quota enforcement."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import col, select

from app.core.config import settings
from app.core.time import utcnow
from app.models.agent_token_daily_usage import AgentTokenDailyUsage
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
    limit: int | None
    quota_reached: bool


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
    ) -> None:
        row = (
            await self.session.exec(
                select(AgentTokenDailyUsage)
                .where(col(AgentTokenDailyUsage.organization_id) == organization_id)
                .where(col(AgentTokenDailyUsage.agent_id) == agent_id)
                .where(col(AgentTokenDailyUsage.usage_date_vn) == usage_date_vn),
            )
        ).first()
        if row is None or row.blocked_at is not None:
            return
        now = utcnow()
        row.blocked_at = now
        row.updated_at = now
        self.session.add(row)
        await self.session.flush()

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
        limit = policy.agent_daily_tokens
        if limit is None:
            return AgentQuotaSyncOutcome(
                agent_id=agent.id,
                organization_id=organization_id,
                billed_total=sync_result.billed_total,
                billed_delta=sync_result.billed_delta,
                limit=None,
                quota_reached=False,
            )

        quota_reached = sync_result.billed_total >= limit
        if quota_reached:
            await self._mark_blocked_if_needed(
                organization_id=organization_id,
                agent_id=agent.id,
                usage_date_vn=sync_result.usage_date_vn,
            )
            self.logger.warning(
                "agent.quota.blocked agent_id=%s organization_id=%s usage_date_vn=%s used=%s limit=%s",
                agent.id,
                organization_id,
                sync_result.usage_date_vn,
                sync_result.billed_total,
                limit,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "quota_exceeded",
                    "message": "agent_daily_tokens quota exceeded for current plan.",
                    "resource": "agent_daily_tokens",
                    "plan": tier,
                    "used": sync_result.billed_total,
                    "limit": limit,
                    "remaining": max(limit - sync_result.billed_total, 0),
                    "agent_id": str(agent.id),
                    "usage_date_vn": sync_result.usage_date_vn.isoformat(),
                },
            )

        return AgentQuotaSyncOutcome(
            agent_id=agent.id,
            organization_id=organization_id,
            billed_total=sync_result.billed_total,
            billed_delta=sync_result.billed_delta,
            limit=limit,
            quota_reached=False,
        )

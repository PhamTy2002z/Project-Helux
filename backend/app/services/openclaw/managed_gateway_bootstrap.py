"""Managed gateway bootstrap helpers for new organizations."""

from __future__ import annotations

from uuid import UUID

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models.agents import Agent
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.services.openclaw.admin_service import GatewayAdminLifecycleService
from app.services.openclaw.gateway_activation_queue import (
    QueuedGatewayActivation,
    enqueue_gateway_activation,
)

logger = get_logger(__name__)
_ENQUEUE_FAILED_ERROR = "Failed to enqueue gateway activation task"


def _managed_gateway_workspace_root(organization_id: UUID) -> str:
    root = settings.managed_gateway_workspace_root.strip().rstrip("/")
    if not root:
        return ""
    return f"{root}/org-{organization_id}"


def _managed_gateway_token() -> str | None:
    token = settings.managed_gateway_token.strip()
    return token or None


def _is_managed_gateway_record(gateway: Gateway, *, expected_url: str) -> bool:
    return (
        (gateway.url or "").strip() == expected_url
        and (gateway.name or "").strip() == settings.managed_gateway_name.strip()
    )


async def _find_org_gateway(session: AsyncSession, organization_id: UUID) -> Gateway | None:
    return (
        await Gateway.objects.filter_by(organization_id=organization_id)
        .order_by(col(Gateway.created_at).asc())
        .first(session)
    )


async def _has_main_agent(session: AsyncSession, gateway_id: UUID) -> bool:
    main_agent = (
        await Agent.objects.filter_by(gateway_id=gateway_id)
        .filter(col(Agent.board_id).is_(None))
        .first(session)
    )
    return main_agent is not None


async def ensure_managed_gateway_for_organization(
    session: AsyncSession,
    *,
    organization_id: UUID,
) -> Gateway | None:
    """Ensure a managed gateway record exists for a new organization."""
    if not settings.managed_gateway_auto_provision:
        return None

    gateway_url = settings.managed_gateway_url.strip()
    workspace_root = _managed_gateway_workspace_root(organization_id)
    if not gateway_url or not workspace_root:
        logger.warning(
            "managed.gateway.bootstrap.skipped_missing_config organization_id=%s has_url=%s has_workspace_root=%s",
            organization_id,
            bool(gateway_url),
            bool(workspace_root),
        )
        return None

    # Serialize org bootstrap to avoid duplicate gateways during concurrent first-login calls.
    await session.exec(
        select(Organization.id).where(col(Organization.id) == organization_id).with_for_update(),
    )

    gateway = await _find_org_gateway(session, organization_id)
    service = GatewayAdminLifecycleService(session)
    if gateway is not None:
        managed_token = _managed_gateway_token()
        if _is_managed_gateway_record(gateway, expected_url=gateway_url):
            current_token = (gateway.token or "").strip() or None
            if managed_token and current_token != managed_token:
                gateway.token = managed_token
                session.add(gateway)
                logger.info(
                    "managed.gateway.bootstrap.token_reconciled organization_id=%s gateway_id=%s",
                    organization_id,
                    gateway.id,
                )
        if not await _has_main_agent(session, gateway.id):
            await service.upsert_main_agent_record(gateway)
        return gateway

    gateway = Gateway(
        organization_id=organization_id,
        name=settings.managed_gateway_name,
        url=gateway_url,
        token=_managed_gateway_token(),
        disable_device_pairing=settings.managed_gateway_disable_device_pairing,
        allow_insecure_tls=settings.managed_gateway_allow_insecure_tls,
        workspace_root=workspace_root,
        activation_status="activating",
        activation_error=None,
        activation_attempts=0,
        last_activation_at=None,
    )
    session.add(gateway)
    await session.flush()

    # Pre-create gateway-main agent row so board creation can proceed immediately.
    await service.upsert_main_agent_record(gateway)

    enqueued = enqueue_gateway_activation(
        QueuedGatewayActivation(gateway_id=gateway.id, action="provision"),
    )
    if not enqueued:
        gateway.activation_status = "degraded"
        gateway.activation_error = _ENQUEUE_FAILED_ERROR
        session.add(gateway)

    logger.info(
        "managed.gateway.bootstrap.created organization_id=%s gateway_id=%s activation_enqueued=%s",
        organization_id,
        gateway.id,
        enqueued,
    )
    return gateway

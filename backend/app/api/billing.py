"""Billing API routes for simulated checkout and subscription reads."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import col, select

from app.api.deps import require_org_admin, require_org_member
from app.core.config import settings
from app.core.logging import get_request_endpoint, get_request_id
from app.db.session import get_session
from app.models.activity_events import ActivityEvent
from app.models.billing_checkout_attempts import BillingCheckoutAttempt
from app.schemas.billing import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingHistoryRow,
    BillingPortalSessionResponse,
    BillingSimulateCheckoutRequest,
    BillingSimulateCheckoutResponse,
    BillingSubscriptionRead,
    BillingSupportTimelineEvent,
    BillingUpgradeModalOpenEvent,
)
from app.schemas.common import OkResponse
from app.services.activity_log import record_activity, record_admin_audit
from app.services.billing import (
    create_checkout_session,
    create_portal_session,
    get_subscription,
    simulate_checkout,
)
from app.services.organizations import OrganizationContext

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/billing", tags=["billing"])
SESSION_DEP = Depends(get_session)
ORG_MEMBER_DEP = Depends(require_org_member)
ORG_ADMIN_DEP = Depends(require_org_admin)
REQUEST_ID_QUERY = Query(min_length=8, max_length=128)
LIMIT_QUERY = Query(default=50, ge=1, le=200)


def _record_billing_metric_event(
    session: AsyncSession,
    *,
    organization_id: UUID,
    event_type: str,
    payload: dict[str, object] | None = None,
) -> None:
    base_payload: dict[str, object] = {
        "request_id": get_request_id(),
        "endpoint": get_request_endpoint(),
    }
    if payload:
        base_payload.update(payload)
    record_activity(
        session,
        event_type=event_type,
        organization_id=organization_id,
        message=json.dumps(base_payload, separators=(",", ":"), sort_keys=True),
    )


@router.get("/me/subscription", response_model=BillingSubscriptionRead)
async def get_my_subscription(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> BillingSubscriptionRead:
    """Return current subscription state for the active organization."""
    return await get_subscription(
        session,
        organization_id=ctx.organization.id,
        billing_mode=settings.billing_mode,
        payment_provider=settings.payment_provider,
    )


PLAN_TIER_PRICES: dict[str, str] = {"pro": "$25.00", "trial_7d": "$0.00"}


@router.get("/me/history", response_model=list[BillingHistoryRow])
async def list_billing_history(
    limit: int = LIMIT_QUERY,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[BillingHistoryRow]:
    """Return billing checkout history for the active organization."""
    rows = list(
        await session.exec(
            select(BillingCheckoutAttempt)
            .where(col(BillingCheckoutAttempt.organization_id) == ctx.organization.id)
            .order_by(col(BillingCheckoutAttempt.created_at).desc())
            .limit(limit)
        )
    )
    return [
        BillingHistoryRow(
            id=row.id,
            plan_tier=row.resolved_plan_tier,
            amount=PLAN_TIER_PRICES.get(row.resolved_plan_tier, "$0.00"),
            status=row.status,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/portal-session", response_model=BillingPortalSessionResponse)
async def get_portal_session(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> BillingPortalSessionResponse:
    """Create Polar customer portal session for subscription management."""
    try:
        return await create_portal_session(
            session,
            organization_id=ctx.organization.id,
            billing_mode=settings.billing_mode,
            payment_provider=settings.payment_provider,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create portal session.",
        ) from exc


@router.post("/simulate/checkout", response_model=BillingSimulateCheckoutResponse)
async def simulate_checkout_unlock(
    payload: BillingSimulateCheckoutRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> BillingSimulateCheckoutResponse:
    """Unlock plan tier with simulated checkout (v1 scaffold)."""
    try:
        result = await simulate_checkout(
            session,
            organization_id=ctx.organization.id,
            payload=payload,
            billing_mode=settings.billing_mode,
            payment_provider=settings.payment_provider,
        )
    except HTTPException as exc:
        error_code = exc.detail.get("code") if isinstance(exc.detail, dict) else None
        _record_billing_metric_event(
            session,
            organization_id=ctx.organization.id,
            event_type="saas.billing.simulated.checkout_failed",
            payload={
                "requested_plan_tier": payload.plan_tier,
                "error_code": error_code if isinstance(error_code, str) else None,
                "status_code": exc.status_code,
            },
        )
        await session.commit()
        raise
    except Exception as exc:
        _record_billing_metric_event(
            session,
            organization_id=ctx.organization.id,
            event_type="saas.billing.simulated.checkout_failed",
            payload={
                "requested_plan_tier": payload.plan_tier,
                "error_type": type(exc).__name__,
            },
        )
        await session.commit()
        raise

    _record_billing_metric_event(
        session,
        organization_id=ctx.organization.id,
        event_type="saas.billing.simulated.checkout_succeeded",
        payload={
            "requested_plan_tier": payload.plan_tier,
            "resolved_plan_tier": result.subscription.plan_tier,
            "idempotent_replay": result.idempotent_replay,
        },
    )
    record_admin_audit(
        session,
        audit_action="billing.simulate.checkout",
        endpoint="/api/v1/billing/simulate/checkout",
        organization_id=ctx.organization.id,
        actor_id=ctx.member.user_id,
        target_id=ctx.organization.id,
        details={
            "requested_plan_tier": payload.plan_tier,
            "resolved_plan_tier": result.subscription.plan_tier,
            "idempotent_replay": result.idempotent_replay,
            "billing_mode": settings.billing_mode,
        },
    )
    await session.commit()
    return result


@router.post("/checkout", response_model=BillingCheckoutResponse)
async def create_checkout(
    payload: BillingCheckoutRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_ADMIN_DEP,
) -> BillingCheckoutResponse:
    """Create real checkout session via payment provider (provider mode only)."""
    user_email = getattr(ctx.member, "email", "") or ""
    try:
        result = await create_checkout_session(
            session,
            organization_id=ctx.organization.id,
            user_email=user_email,
            payload=payload,
            billing_mode=settings.billing_mode,
            payment_provider=settings.payment_provider,
        )
    except HTTPException:
        raise
    except Exception as exc:
        _record_billing_metric_event(
            session,
            organization_id=ctx.organization.id,
            event_type="saas.billing.checkout_failed",
            payload={"error_type": type(exc).__name__},
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create checkout session with payment provider.",
        ) from exc

    _record_billing_metric_event(
        session,
        organization_id=ctx.organization.id,
        event_type="saas.billing.checkout_created",
        payload={
            "provider": "polar",
            "plan_tier": payload.plan_tier,
            "checkout_id": result.checkout_id,
        },
    )
    await session.commit()
    return result


@router.post("/events/upgrade-modal-open", response_model=OkResponse)
async def track_upgrade_modal_open(
    payload: BillingUpgradeModalOpenEvent,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> OkResponse:
    """Track upgrade modal open events for billing-support observability."""
    _record_billing_metric_event(
        session,
        organization_id=ctx.organization.id,
        event_type="saas.billing.simulated.upgrade_modal_open",
        payload={"source": payload.source},
    )
    await session.commit()
    return OkResponse()


@router.get("/support/timeline", response_model=list[BillingSupportTimelineEvent])
async def list_billing_support_timeline(
    request_id: str = REQUEST_ID_QUERY,
    limit: int = LIMIT_QUERY,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[BillingSupportTimelineEvent]:
    """Return billing/support events that match request-id within active organization."""
    rows = list(
        await session.exec(
            select(ActivityEvent)
            .where(col(ActivityEvent.organization_id) == ctx.organization.id)
            .where(col(ActivityEvent.message).contains(request_id))
            .order_by(col(ActivityEvent.created_at).asc())
            .limit(limit)
        )
    )
    output: list[BillingSupportTimelineEvent] = []
    for row in rows:
        request_id_value: str | None = None
        endpoint: str | None = None
        details: dict[str, object] | None = None
        if row.message:
            try:
                payload = json.loads(row.message)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict):
                raw_request_id = payload.get("request_id")
                request_id_value = raw_request_id if isinstance(raw_request_id, str) else None
                raw_endpoint = payload.get("endpoint")
                endpoint = raw_endpoint if isinstance(raw_endpoint, str) else None
                raw_details = payload.get("details")
                details = raw_details if isinstance(raw_details, dict) else None
        output.append(
            BillingSupportTimelineEvent(
                id=row.id,
                event_type=row.event_type,
                request_id=request_id_value,
                endpoint=endpoint,
                created_at=row.created_at,
                details=details,
            )
        )
    return output

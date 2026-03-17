"""Billing helpers for simulated checkout and subscription state resolution."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.time import utcnow
from app.models.billing_checkout_attempts import BillingCheckoutAttempt
from app.models.organization_plans import OrganizationPlan
from app.schemas.billing import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingPortalSessionResponse,
    BillingSimulateCheckoutRequest,
    BillingSimulateCheckoutResponse,
    BillingSubscriptionRead,
    SubscriptionStatus,
)
from app.services.entitlements import (
    TRIAL_DURATION_DAYS,
    coerce_plan_tier,
    get_or_create_organization_plan,
    get_organization_plan_for_update,
)


def _subscription_status(*, tier: str, effective_until: datetime | None) -> SubscriptionStatus:
    now = utcnow()
    if effective_until is not None and effective_until <= now:
        return "blocked_for_payment"
    return "active"


def subscription_from_plan(
    *,
    organization_id: UUID,
    plan: OrganizationPlan,
    billing_mode: str,
    payment_provider: str,
) -> BillingSubscriptionRead:
    """Build normalized subscription payload from an organization plan row."""
    tier = coerce_plan_tier(plan.tier)
    status_value = _subscription_status(tier=tier, effective_until=plan.effective_until)
    trial_expires_at = plan.effective_until if tier == "trial_7d" else None
    return BillingSubscriptionRead(
        organization_id=organization_id,
        plan_tier=tier,
        status=status_value,
        effective_from=plan.effective_from,
        effective_until=plan.effective_until,
        trial_expires_at=trial_expires_at,
        billing_mode=billing_mode,
        payment_provider=payment_provider,
    )


def _merged_plan_metadata(
    *,
    plan: OrganizationPlan,
    payload: BillingSimulateCheckoutRequest,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    if isinstance(plan.plan_metadata, dict):
        metadata.update(plan.plan_metadata)
    billing_data = metadata.get("billing")
    if not isinstance(billing_data, dict):
        billing_data = {}
    billing_data["last_checkout_mode"] = "simulated"
    billing_data["last_checkout_plan_tier"] = payload.plan_tier
    billing_data["last_checkout_at"] = utcnow().isoformat()
    metadata["billing"] = billing_data
    return metadata


def _apply_plan_checkout(
    *,
    plan: OrganizationPlan,
    payload: BillingSimulateCheckoutRequest,
) -> None:
    now = utcnow()
    if payload.plan_tier == "trial_7d":
        plan.tier = "trial_7d"
        plan.effective_from = now
        plan.effective_until = now + timedelta(days=TRIAL_DURATION_DAYS)
    else:
        plan.tier = "pro"
        plan.effective_from = now
        plan.effective_until = None
    plan.plan_metadata = _merged_plan_metadata(plan=plan, payload=payload)
    plan.updated_at = now


async def get_subscription(
    session: AsyncSession,
    *,
    organization_id: UUID,
    billing_mode: str,
    payment_provider: str,
) -> BillingSubscriptionRead:
    """Return current subscription payload for organization."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    return subscription_from_plan(
        organization_id=organization_id,
        plan=plan,
        billing_mode=billing_mode,
        payment_provider=payment_provider,
    )


async def simulate_checkout(
    session: AsyncSession,
    *,
    organization_id: UUID,
    payload: BillingSimulateCheckoutRequest,
    billing_mode: str,
    payment_provider: str,
) -> BillingSimulateCheckoutResponse:
    """Apply simulated checkout idempotently for the organization."""
    if billing_mode != "simulated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Simulated checkout is only available when BILLING_MODE=simulated.",
        )

    existing = await BillingCheckoutAttempt.objects.filter_by(
        organization_id=organization_id,
        idempotency_key=payload.idempotency_key,
    ).first(session)
    if existing is not None:
        plan = await get_or_create_organization_plan(session, organization_id=organization_id)
        subscription = subscription_from_plan(
            organization_id=organization_id,
            plan=plan,
            billing_mode=billing_mode,
            payment_provider=payment_provider,
        )
        return BillingSimulateCheckoutResponse(
            checkout_id=existing.id,
            idempotent_replay=True,
            subscription=subscription,
        )

    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    locked_plan = await get_organization_plan_for_update(session, organization_id=organization_id)
    if locked_plan is not None:
        plan = locked_plan
    _apply_plan_checkout(plan=plan, payload=payload)
    attempt = BillingCheckoutAttempt(
        organization_id=organization_id,
        idempotency_key=payload.idempotency_key,
        requested_plan_tier=payload.plan_tier,
        resolved_plan_tier=plan.tier,
        status="succeeded",
    )
    session.add(plan)
    session.add(attempt)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await BillingCheckoutAttempt.objects.filter_by(
            organization_id=organization_id,
            idempotency_key=payload.idempotency_key,
        ).first(session)
        if existing is None:
            raise
        plan = await get_or_create_organization_plan(session, organization_id=organization_id)
        subscription = subscription_from_plan(
            organization_id=organization_id,
            plan=plan,
            billing_mode=billing_mode,
            payment_provider=payment_provider,
        )
        return BillingSimulateCheckoutResponse(
            checkout_id=existing.id,
            idempotent_replay=True,
            subscription=subscription,
        )

    await session.refresh(plan)
    await session.refresh(attempt)
    subscription = subscription_from_plan(
        organization_id=organization_id,
        plan=plan,
        billing_mode=billing_mode,
        payment_provider=payment_provider,
    )
    return BillingSimulateCheckoutResponse(
        checkout_id=attempt.id,
        idempotent_replay=False,
        subscription=subscription,
    )


async def create_checkout_session(
    session: AsyncSession,
    *,
    organization_id: UUID,
    user_email: str,
    payload: BillingCheckoutRequest,
    billing_mode: str,
    payment_provider: str,
) -> BillingCheckoutResponse:
    """Create real checkout session via configured payment provider."""
    if billing_mode != "provider":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Real checkout only available when BILLING_MODE=provider.",
        )
    if payment_provider != "polar":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Payment provider '{payment_provider}' not yet supported.",
        )

    from app.core.config import settings as app_settings
    from app.services.polar_client import get_polar_client

    client = get_polar_client()
    product_id = app_settings.polar_product_id_pro
    success_url = (
        app_settings.polar_success_url
        or f"{app_settings.base_url}/checkout/success?checkout_id={{CHECKOUT_ID}}"
    )

    # Check for existing Polar customer to avoid duplicates (BUG-7)
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    billing_meta: dict[str, object] = {}
    if isinstance(plan.plan_metadata, dict):
        raw_billing = plan.plan_metadata.get("billing")
        billing_meta = raw_billing if isinstance(raw_billing, dict) else {}

    existing_customer_id = billing_meta.get("polar_customer_id")

    checkout_request: dict[str, Any] = {
        "products": [product_id],
        "success_url": success_url,
        "customer_email": user_email or None,
        "metadata": {
            "organization_id": str(organization_id),
            "plan_tier": payload.plan_tier,
            "idempotency_key": payload.idempotency_key,
        },
    }

    # Link to existing Polar customer if available
    if existing_customer_id and isinstance(existing_customer_id, str):
        checkout_request["customer_id"] = existing_customer_id
    else:
        # First checkout: use external_customer_id for stable binding
        checkout_request["external_customer_id"] = str(organization_id)

    checkout = await client.checkouts.create_async(request=checkout_request)  # type: ignore[arg-type]

    # No DB record here — webhook creates it on confirmed payment only

    return BillingCheckoutResponse(
        checkout_url=checkout.url,
        checkout_id=str(checkout.id),
        provider="polar",
    )


async def create_portal_session(
    session: AsyncSession,
    *,
    organization_id: UUID,
    billing_mode: str,
    payment_provider: str,
) -> BillingPortalSessionResponse:
    """Create Polar customer portal session for subscription management."""
    if billing_mode != "provider":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Portal session only available when BILLING_MODE=provider.",
        )
    if payment_provider != "polar":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Payment provider '{payment_provider}' not supported.",
        )

    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    billing_meta: dict[str, object] = {}
    if isinstance(plan.plan_metadata, dict):
        raw_billing = plan.plan_metadata.get("billing")
        billing_meta = raw_billing if isinstance(raw_billing, dict) else {}

    customer_id = billing_meta.get("polar_customer_id")
    if not customer_id or not isinstance(customer_id, str):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Polar customer found for this organization. Complete a checkout first.",
        )

    from app.core.config import settings as portal_settings
    from app.services.polar_client import get_polar_client

    client = get_polar_client()
    return_url = f"{portal_settings.base_url}/settings"
    portal_session = await client.customer_sessions.create_async(
        request={"customer_id": customer_id, "return_url": return_url}
    )

    return BillingPortalSessionResponse(
        portal_url=portal_session.customer_portal_url,
    )

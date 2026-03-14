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
    BillingSimulateCheckoutRequest,
    BillingSimulateCheckoutResponse,
    BillingSubscriptionRead,
    SubscriptionStatus,
)
from app.services.entitlements import (
    TRIAL_DURATION_DAYS,
    coerce_plan_tier,
    get_or_create_organization_plan,
)


def _subscription_status(*, tier: str, effective_until: datetime | None) -> SubscriptionStatus:
    now = utcnow()
    if tier == "trial_7d" and effective_until is not None and effective_until <= now:
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

    checkout = await client.checkouts.create_async(
        request={
            "products": [product_id],
            "success_url": success_url,
            "customer_email": user_email or None,
            "metadata": {
                "organization_id": str(organization_id),
                "plan_tier": payload.plan_tier,
                "idempotency_key": payload.idempotency_key,
            },
        }
    )

    # Record checkout attempt as pending (webhook will finalize)
    attempt = BillingCheckoutAttempt(
        organization_id=organization_id,
        idempotency_key=payload.idempotency_key,
        requested_plan_tier=payload.plan_tier,
        resolved_plan_tier=payload.plan_tier,
        status="pending",
    )
    session.add(attempt)
    await session.commit()

    return BillingCheckoutResponse(
        checkout_url=checkout.url,
        checkout_id=str(checkout.id),
        provider="polar",
    )

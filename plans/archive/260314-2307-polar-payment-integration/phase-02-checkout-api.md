---
phase: 2
title: "Checkout API Endpoint"
status: pending
effort: 1.5h
depends_on: [1]
---

# Phase 2: Checkout API Endpoint

## Context

- [billing.py (routes)](../../backend/app/api/billing.py) -- existing billing API
- [billing.py (service)](../../backend/app/services/billing.py) -- existing billing service
- [billing schemas](../../backend/app/schemas/billing.py) -- Pydantic schemas

## Overview

Add `POST /api/v1/billing/checkout` that creates a Polar checkout session and returns the checkout URL. Only active when `BILLING_MODE=provider`.

## Related Code Files

**Modify:**
- `backend/app/schemas/billing.py` -- add checkout request/response schemas
- `backend/app/services/billing.py` -- add `create_checkout_session` function
- `backend/app/api/billing.py` -- add checkout route

## Implementation Steps

### 1. Add schemas to billing.py (schemas)

```python
class BillingCheckoutRequest(SQLModel):
    """Request to create a real checkout session via payment provider."""
    plan_tier: PlanTier
    idempotency_key: str = Field(min_length=4, max_length=128)


class BillingCheckoutResponse(SQLModel):
    """Response with checkout URL for redirect."""
    checkout_url: str
    checkout_id: str
    provider: str
```

### 2. Add create_checkout_session to billing service

In `backend/app/services/billing.py`, add function (~50 lines):

```python
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

    from app.services.polar_client import get_polar_client
    from app.core.config import settings as app_settings

    client = get_polar_client()
    price_id = app_settings.polar_product_price_id_pro  # only pro tier for now
    success_url = app_settings.polar_success_url or f"{app_settings.base_url}/checkout/success?checkout_id={{CHECKOUT_ID}}"

    checkout = await client.checkouts.create(request={
        "product_price_id": price_id,
        "success_url": success_url,
        "customer_email": user_email,
        "metadata": {
            "organization_id": str(organization_id),
            "plan_tier": payload.plan_tier,
            "idempotency_key": payload.idempotency_key,
        },
    })

    # Record attempt
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
```

### 3. Add route to billing.py (api)

Add to `backend/app/api/billing.py`:

```python
from app.schemas.billing import BillingCheckoutRequest, BillingCheckoutResponse

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
```

### 4. Get user email

Check how `ctx.member` exposes email. If not available directly, use organization owner email or pass empty string (Polar allows it).

Look at `OrganizationContext` to find email field. If `ctx.member` has no email, check `ctx.user` or resolve from Clerk user data.

**Fallback:** Pass `""` -- Polar will prompt for email on checkout page.

## Todo

- [ ] Add `BillingCheckoutRequest` + `BillingCheckoutResponse` schemas
- [ ] Add `create_checkout_session` to billing service
- [ ] Add `POST /checkout` route to billing API
- [ ] Resolve user email from context (or fallback to empty)
- [ ] Add import for `create_checkout_session` in api/billing.py
- [ ] Test: simulated mode returns 409 when hitting `/checkout`
- [ ] Test: provider mode returns checkout URL

## Success Criteria

- `POST /api/v1/billing/checkout` returns `{ checkout_url, checkout_id, provider }` in provider mode
- Returns 409 in simulated mode
- Records `BillingCheckoutAttempt` with status "pending"
- Activity event logged

## Risk Assessment

- **Polar SDK API shape may differ** -- verify `client.checkouts.create` request format against latest SDK docs before implementation. The `request={}` dict pattern vs positional args varies by SDK version.
- **Email resolution** -- may need to query Clerk API if email not on member context. Fallback to empty string is safe.

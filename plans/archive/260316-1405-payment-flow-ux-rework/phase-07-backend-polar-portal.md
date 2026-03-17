# Phase 07 -- Backend: Polar Customer Portal Endpoint

## Context Links
- Plan: `plan.md`
- Billing API: `backend/app/api/billing.py`
- Polar client: `backend/app/services/polar_client.py`
- Billing service: `backend/app/services/billing.py`
- Billing schemas: `backend/app/schemas/billing.py`
- Polar SDK docs: `customer_sessions.create(customer_id=...)` returns portal URL

## Overview
- **Priority:** P1
- **Status:** done
- **Description:** Add `GET /api/v1/billing/portal-session` endpoint that creates a Polar customer portal session and returns the portal URL. Used by billing page (Phase 3) for "Manage Subscription".

## Key Insights
- Polar SDK: `polar.customer_sessions.create(customer_id="cust_xxx")` -> returns `{ customer_portal_url: "https://polar.sh/..." }`
- Need to map org -> Polar customer ID. Two approaches:
  1. Store `polar_customer_id` in `organization_plans.plan_metadata.billing`
  2. Look up customer by email via Polar API
- **Decision:** Store in metadata during webhook processing (approach 1). More reliable, no extra API call.
- `_handle_subscription_active` already writes to `plan_metadata.billing` -- add `polar_customer_id` there
- Customer ID is available in webhook event data: `event.data.customer_id` or `event.data.customer.id`

## Requirements
### Functional
- `GET /api/v1/billing/portal-session` -> `{ portal_url: string, customer_id: string }`
- Requires org admin auth
- Creates a Polar customer session with short-lived portal URL
- Returns 404 if no Polar customer ID found for org
- Returns 409 if `billing_mode != "provider"`
- Returns 502 if Polar API call fails

### Non-Functional
- Portal URL is ephemeral (Polar controls TTL)
- No caching -- always create fresh session
- Response time: <2s (Polar API call)

## Architecture

```
Frontend: "Manage Subscription" button click
  |
  +-> GET /api/v1/billing/portal-session
       |
       +-> Load org plan, extract polar_customer_id from metadata
       +-> polar.customer_sessions.create(customer_id=...)
       +-> Return { portal_url, customer_id }
       |
Frontend: window.open(portal_url, "_blank")
```

## Related Code Files

| File | Action |
|------|--------|
| `backend/app/api/billing.py` | MODIFY -- add portal-session endpoint |
| `backend/app/services/billing.py` | MODIFY -- add `create_portal_session` function |
| `backend/app/schemas/billing.py` | MODIFY -- add `BillingPortalSessionResponse` schema |
| `backend/app/services/polar_client.py` | NO CHANGE -- client already initialized |
| `backend/app/services/billing_webhook_service.py` | MODIFY -- store polar_customer_id in metadata |

## Implementation Steps

### 1. Update webhook service to store customer ID
In `backend/app/services/billing_webhook_service.py`, update `_handle_subscription_active`:

```python
# Add to the metadata update in _handle_subscription_active:
plan.plan_metadata = {
    **existing_meta,
    "billing": {
        **existing_billing,
        "last_checkout_mode": "polar",
        "last_checkout_at": now.isoformat(),
        "polar_subscription_id": _safe_get(event_data, "id"),
        "polar_customer_id": _safe_get(event_data, "customer_id")
            or _safe_get(_safe_get(event_data, "customer"), "id"),
    },
}
```

### 2. Add schema
In `backend/app/schemas/billing.py`:

```python
class BillingPortalSessionResponse(SQLModel):
    """Polar customer portal session URL."""
    portal_url: str
    customer_id: str
```

### 3. Add service function
In `backend/app/services/billing.py`:

```python
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
    billing_meta = {}
    if isinstance(plan.plan_metadata, dict):
        billing_meta = plan.plan_metadata.get("billing", {})
        if not isinstance(billing_meta, dict):
            billing_meta = {}

    customer_id = billing_meta.get("polar_customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Polar customer found for this organization. Complete a checkout first.",
        )

    from app.services.polar_client import get_polar_client
    client = get_polar_client()

    portal_session = await client.customer_sessions.create_async(
        request={"customer_id": customer_id}
    )

    return BillingPortalSessionResponse(
        portal_url=portal_session.customer_portal_url,
        customer_id=customer_id,
    )
```

### 4. Add API endpoint
In `backend/app/api/billing.py`:

```python
from app.schemas.billing import BillingPortalSessionResponse
from app.services.billing import create_portal_session

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
```

### 5. Regenerate Orval types (if API uses OpenAPI spec generation)
After adding the endpoint, run Orval codegen to generate frontend types. Or use manual fetch in `billing.ts` (Phase 3 covers this).

## Todo List
- [ ] Store `polar_customer_id` in webhook metadata (`billing_webhook_service.py`)
- [ ] Add `BillingPortalSessionResponse` schema
- [ ] Add `create_portal_session` service function
- [ ] Add `GET /portal-session` API endpoint
- [ ] Test: portal session returns valid URL for Pro org
- [ ] Test: 404 when org has no Polar customer ID
- [ ] Test: 409 when billing_mode is simulated
- [ ] Test: 502 when Polar API fails
- [ ] Backfill: existing Pro orgs may not have `polar_customer_id` in metadata
  - Option A: migration script to look up customer by org metadata
  - Option B: fallback to Polar customer lookup by email in service

## Success Criteria
- `GET /api/v1/billing/portal-session` returns valid Polar portal URL
- Portal URL opens Polar's pre-authenticated management dashboard
- Proper error handling for missing customer, wrong billing mode, Polar failures

## Risk Assessment
- **Missing customer ID for existing Pro orgs:** Webhook handler update only applies to future subscriptions. Need backfill strategy for existing orgs.
  - **Mitigation:** Add fallback in `create_portal_session` -- if no `polar_customer_id` in metadata, attempt lookup via `polar.customers.list(email=...)`. Log warning for monitoring.
- **Polar API rate limits:** Customer session creation is low-volume. No concern.
- **Portal URL expiry:** Polar portal URLs are short-lived. Always create fresh session on request.

## Security Considerations
- Endpoint requires org admin role
- Portal session is scoped to the specific Polar customer
- No payment data returned in our API response
- Portal URL should not be logged (contains auth token)

## Next Steps
- Phase 3 (billing page) consumes this endpoint via `usePortalSession` hook
- Phase 6 (billing emails) uses webhook metadata for customer identification

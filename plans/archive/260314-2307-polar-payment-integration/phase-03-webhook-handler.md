---
phase: 3
title: "Webhook Endpoint & Event Processing"
status: pending
effort: 2h
depends_on: [1]
---

# Phase 3: Webhook Endpoint & Event Processing

## Context

- [entitlements.py](../../backend/app/services/entitlements.py) -- `get_or_create_organization_plan`, plan tier helpers
- [organization_plans.py](../../backend/app/models/organization_plans.py) -- OrganizationPlan model
- [main.py](../../backend/app/main.py) -- router registration

## Overview

Create webhook endpoint for Polar events. Verify signature, parse event, dispatch to handler that flips plan tier in DB.

Two new files:
1. `backend/app/api/billing_webhooks.py` -- FastAPI route (unauthenticated, signature-verified)
2. `backend/app/services/billing_webhook_service.py` -- event processing logic

## Related Code Files

**Create:**
- `backend/app/api/billing_webhooks.py`
- `backend/app/services/billing_webhook_service.py`

**Modify:**
- `backend/app/main.py` -- register webhook router

## Implementation Steps

### 1. Create billing_webhooks.py (route)

New file: `backend/app/api/billing_webhooks.py` (~60 lines)

```python
"""Polar webhook receiver -- unauthenticated, signature-verified."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing/webhooks", tags=["billing-webhooks"])


@router.post("/polar")
async def handle_polar_webhook(request: Request) -> dict[str, str]:
    """Receive and process Polar webhook events."""
    if settings.payment_provider != "polar":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Polar webhooks not enabled.",
        )

    body = await request.body()
    headers = dict(request.headers)

    # Verify signature
    try:
        from polar_sdk.webhooks import validate_event

        event = validate_event(
            payload=body,
            headers=headers,
            secret=settings.polar_webhook_secret,
        )
    except Exception as exc:
        logger.warning("Polar webhook signature verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        ) from exc

    # Process event
    from app.services.billing_webhook_service import process_polar_event

    async for session in get_session():
        await process_polar_event(session, event=event)

    return {"status": "ok"}
```

**Important:** This route must NOT require auth middleware. Register it outside the auth-protected group or ensure the billing webhook prefix is excluded from auth checks.

### 2. Create billing_webhook_service.py

New file: `backend/app/services/billing_webhook_service.py` (~100 lines)

```python
"""Process Polar webhook events and update organization plans."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.time import utcnow
from app.services.entitlements import get_or_create_organization_plan

logger = logging.getLogger(__name__)

# Events we handle
HANDLED_EVENTS = {
    "subscription.active",
    "subscription.revoked",
    "subscription.canceled",
    "order.paid",
}


def _extract_org_id(metadata: dict[str, Any] | None) -> UUID | None:
    """Extract organization_id from event metadata."""
    if not metadata:
        return None
    raw = metadata.get("organization_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


async def _handle_subscription_active(
    session: AsyncSession, *, organization_id: UUID, event_data: dict[str, Any]
) -> None:
    """Subscription confirmed active -> flip to pro."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()
    plan.tier = "pro"
    plan.effective_from = now
    plan.effective_until = None  # pro has no expiry
    plan.plan_metadata = {
        **(plan.plan_metadata or {}),
        "billing": {
            **((plan.plan_metadata or {}).get("billing") or {}),
            "last_checkout_mode": "polar",
            "last_checkout_at": now.isoformat(),
            "polar_subscription_id": event_data.get("id"),
        },
    }
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s upgraded to pro via Polar webhook", organization_id)


async def _handle_subscription_revoked(
    session: AsyncSession, *, organization_id: UUID, event_data: dict[str, Any]
) -> None:
    """Subscription revoked (failed payment, manual cancel with immediate effect)."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()
    plan.tier = "trial_7d"
    plan.effective_from = plan.effective_from  # keep original start
    plan.effective_until = now  # expired immediately -> blocked_for_payment
    plan.updated_at = now
    session.add(plan)
    await session.commit()
    logger.info("Org %s revoked to trial (blocked) via Polar webhook", organization_id)


async def _handle_subscription_canceled(
    session: AsyncSession, *, organization_id: UUID, event_data: dict[str, Any]
) -> None:
    """Subscription canceled -- keep pro until period end (logged only)."""
    logger.info(
        "Org %s subscription canceled via Polar (pro remains until period end)",
        organization_id,
    )


async def _handle_order_paid(
    session: AsyncSession, *, organization_id: UUID, event_data: dict[str, Any]
) -> None:
    """Order paid -- log for audit trail."""
    logger.info("Org %s order paid via Polar: %s", organization_id, event_data.get("id"))


_HANDLERS = {
    "subscription.active": _handle_subscription_active,
    "subscription.revoked": _handle_subscription_revoked,
    "subscription.canceled": _handle_subscription_canceled,
    "order.paid": _handle_order_paid,
}


async def process_polar_event(session: AsyncSession, *, event: Any) -> None:
    """Dispatch Polar webhook event to appropriate handler."""
    event_type = getattr(event, "type", None) or ""
    if event_type not in HANDLED_EVENTS:
        logger.debug("Ignoring Polar event type: %s", event_type)
        return

    # Extract metadata from event data
    event_data = getattr(event, "data", {}) or {}
    metadata = (
        getattr(event_data, "metadata", None)
        or (event_data.get("metadata") if isinstance(event_data, dict) else None)
    )
    org_id = _extract_org_id(metadata)
    if org_id is None:
        logger.warning("Polar event %s missing organization_id in metadata", event_type)
        return

    handler = _HANDLERS.get(event_type)
    if handler:
        event_dict = event_data if isinstance(event_data, dict) else {}
        await handler(session, organization_id=org_id, event_data=event_dict)
```

### 3. Register webhook router in main.py

In `backend/app/main.py`:

```python
from app.api.billing_webhooks import router as billing_webhooks_router

# Register OUTSIDE auth-protected group (webhook is unauthenticated)
api_v1.include_router(billing_webhooks_router)
```

**Verify:** Ensure the webhook path `/api/v1/billing/webhooks/polar` is not behind auth middleware. Check how auth middleware is applied -- if it's global, may need to add an exclusion for this path.

### 4. Auth bypass for webhook

Check `main.py` for auth middleware configuration. If auth is applied as dependency on `api_v1` router, the webhook needs special handling:

**Option A:** Register webhook router on a separate prefix outside `api_v1`
**Option B:** Add webhook path to auth middleware exclusion list

Inspect `main.py` auth setup to determine correct approach.

## Todo

- [ ] Create `billing_webhooks.py` with Polar webhook route
- [ ] Create `billing_webhook_service.py` with event handlers
- [ ] Register webhook router in main.py
- [ ] Verify webhook path bypasses auth middleware
- [ ] Handle `subscription.active` -> flip to pro
- [ ] Handle `subscription.revoked` -> block (expired trial)
- [ ] Handle `subscription.canceled` -> log only
- [ ] Handle `order.paid` -> log for audit
- [ ] Verify `validate_event` API from polar-sdk (payload type: bytes vs str)

## Success Criteria

- `POST /api/v1/billing/webhooks/polar` accepts Polar events without auth
- Invalid signature returns 400
- `subscription.active` flips org plan to pro
- `subscription.revoked` blocks org (trial expired)
- Unknown events return 200 (idempotent, no error)
- Missing `organization_id` in metadata logs warning, returns 200

## Security Considerations

- Webhook signature verification is the ONLY auth mechanism -- must not be skippable
- Never trust event data without signature check
- Log all webhook events for audit
- Return 200 for unhandled events to prevent Polar retries

## Risk Assessment

- **Event data shape** -- Polar SDK event objects may use attribute access (`.data.metadata`) or dict access. Implementation must handle both. Verify against SDK version.
- **Auth bypass** -- must verify webhook path is excluded from Clerk/local auth. Test this explicitly.
- **Session management** -- `async for session in get_session()` pattern must match project convention. Check how other unauthenticated endpoints handle sessions.

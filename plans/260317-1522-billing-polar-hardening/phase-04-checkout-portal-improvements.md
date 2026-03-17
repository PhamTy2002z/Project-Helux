---
phase: 4
status: pending
priority: P1
effort: M
depends_on: [1, 3]
---

# Phase 4: Checkout & Portal Improvements

## Context
- BUG-7: Checkout không truyền `customer_id` → duplicate Polar customers
- BUG-6: Portal session thiếu `return_url` → user mắc kẹt
- Missing: `checkout.updated` event handling

## Related Code Files

**Modify:**
- `backend/app/services/billing.py` — checkout + portal fixes
- `backend/app/services/billing_webhook_service.py` — add checkout.updated handler

## Implementation Steps

### 4.1 Pass existing `customer_id` on repeat checkout (BUG-7)

File: `backend/app/services/billing.py`, function `create_checkout_session`

```python
# Before creating Polar checkout, check if org already has a Polar customer
plan = await get_or_create_organization_plan(session, organization_id=organization_id)
billing_meta = {}
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

checkout = await client.checkouts.create_async(request=checkout_request)
```

**Why `external_customer_id`**: Polar uses this to auto-match or create customers. If same `external_customer_id` is used later, Polar links to existing customer automatically.

### 4.2 Add `return_url` to portal session (BUG-6)

File: `backend/app/services/billing.py`, function `create_portal_session`

```python
# BEFORE:
portal_session = await client.customer_sessions.create_async(
    request={"customer_id": customer_id}
)

# AFTER:
from app.core.config import settings as app_settings

return_url = f"{app_settings.base_url}/settings"
portal_session = await client.customer_sessions.create_async(
    request={
        "customer_id": customer_id,
        "return_url": return_url,
    }
)
```

### 4.3 Handle `checkout.updated` event

File: `backend/app/services/billing_webhook_service.py`

```python
async def _handle_checkout_updated(
    session, *, organization_id, event_data
) -> None:
    """Checkout updated (expired, failed) — log for audit trail."""
    checkout_status = _safe_get(event_data, "status")
    logger.info(
        "Org %s checkout updated: status=%s, id=%s",
        organization_id,
        checkout_status,
        _safe_get(event_data, "id"),
    )
    # No plan changes — checkout status doesn't affect subscription
    # Stored in polar_webhook_events table for audit (Phase 2)
```

Update maps:
```python
HANDLED_EVENTS.add("checkout.updated")
_HANDLERS["checkout.updated"] = _handle_checkout_updated
```

**Note**: `checkout.updated` may not have `organization_id` in metadata (checkout not yet completed). Handle `org_id is None` gracefully — store event in webhook_events table but skip handler.

### 4.4 Add Polar API timeout configuration

File: `backend/app/services/polar_client.py`

```python
import httpx

_client = Polar(
    access_token=settings.polar_access_token,
    server=_server,
    timeout_ms=10_000,  # 10 second timeout for all Polar API calls
)
```

**Verify**: Check if Polar SDK accepts `timeout_ms` or uses httpx timeout config. If not, wrap calls with `asyncio.wait_for()` in `billing.py`.

## Todo List

- [ ] 4.1 Pass `customer_id` / `external_customer_id` on checkout
- [ ] 4.2 Add `return_url` to portal session
- [ ] 4.3 Handle `checkout.updated` event
- [ ] 4.4 Add Polar API timeout
- [ ] 4.5 Compile check all modified files

## Success Criteria

- Repeat checkout reuses existing Polar customer (no duplicates)
- First checkout sets `external_customer_id = organization_id`
- Portal session has back button to FlowGrid settings
- `checkout.updated` events logged
- Polar API calls timeout after 10s instead of hanging

## Risk Assessment

- **BUG-7**: Medium risk — `customer_id` param may be ignored if customer doesn't exist on Polar side. `external_customer_id` is safer fallback.
- **Portal return_url**: Low risk — cosmetic UX improvement
- **Timeout**: Verify SDK param name before implementation

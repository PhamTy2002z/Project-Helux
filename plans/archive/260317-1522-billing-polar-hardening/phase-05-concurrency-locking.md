---
phase: 5
status: pending
priority: P1
effort: S
depends_on: [3]
---

# Phase 5: Concurrency & Row-Level Locking

## Context
- Concurrent webhook events can corrupt OrganizationPlan state
- No `SELECT FOR UPDATE` on plan reads before writes
- Token quota sync also lacks locking

## Overview

Add row-level locking on `OrganizationPlan` during webhook processing and checkout flows to prevent concurrent state corruption.

## Related Code Files

**Modify:**
- `backend/app/services/billing_webhook_service.py` — lock plan during webhook processing
- `backend/app/services/entitlements.py` — add locked read function
- `backend/app/services/billing.py` — lock plan during simulated checkout

## Implementation Steps

### 5.1 Add locked plan fetch utility

File: `backend/app/services/entitlements.py`

```python
async def get_organization_plan_for_update(
    session: AsyncSession, *, organization_id: UUID
) -> OrganizationPlan | None:
    """Fetch plan with row-level lock (SELECT ... FOR UPDATE).

    Use when modifying plan state to prevent concurrent writes.
    Must be called within a transaction.
    """
    from sqlalchemy import select

    stmt = (
        select(OrganizationPlan)
        .where(OrganizationPlan.organization_id == organization_id)
        .with_for_update()
    )
    result = await session.exec(stmt)
    return result.first()
```

### 5.2 Use locked fetch in webhook handlers

File: `backend/app/services/billing_webhook_service.py`

Replace all `get_or_create_organization_plan` calls inside handlers with:

```python
from app.services.entitlements import get_organization_plan_for_update, get_or_create_organization_plan

async def _handle_subscription_active(session, *, organization_id, event_data):
    # First ensure plan exists (unlocked)
    await get_or_create_organization_plan(session, organization_id=organization_id)
    # Then lock for update
    plan = await get_organization_plan_for_update(session, organization_id=organization_id)
    if plan is None:
        logger.error("Plan not found after create for org %s", organization_id)
        return
    # ... rest of handler (plan modifications)
```

Apply same pattern to: `_handle_subscription_revoked`, `_handle_subscription_canceled`, `_handle_subscription_uncanceled`, `_handle_subscription_updated`.

### 5.3 Use locked fetch in simulated checkout

File: `backend/app/services/billing.py`, function `simulate_checkout`

Lock plan before modifying:
```python
# After idempotency check passes:
plan = await get_organization_plan_for_update(session, organization_id=organization_id)
if plan is None:
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    plan = await get_organization_plan_for_update(session, organization_id=organization_id)
```

## Todo List

- [ ] 5.1 Add `get_organization_plan_for_update` to entitlements service
- [ ] 5.2 Update all webhook handlers to use locked fetch
- [ ] 5.3 Update simulated checkout to use locked fetch
- [ ] 5.4 Compile check

## Success Criteria

- Concurrent webhook events for same org serialize properly
- No plan state corruption under concurrent access
- Existing behavior unchanged for single-request scenarios
- Deadlock risk minimal (single row lock, single table)

## Risk Assessment

- **Low risk**: `FOR UPDATE` is standard PostgreSQL pattern
- **Deadlock**: Only locks single `organization_plans` row — deadlock requires two concurrent txns locking different rows in reverse order (not possible in this flow)
- **Performance**: Lock held only during handler execution (~10ms), no impact on throughput

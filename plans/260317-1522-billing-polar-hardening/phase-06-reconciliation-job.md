---
phase: 6
status: pending
priority: P1
effort: M
depends_on: [3, 4]
---

# Phase 6: Reconciliation Job

## Context
- No mechanism to detect state drift between FlowGrid and Polar
- Lost webhooks = permanent inconsistency
- Need periodic sync to verify plan states match Polar subscription statuses

## Overview

Implement scheduled reconciliation job that queries Polar API and compares with local plan state. Alerts on discrepancies, auto-fixes safe cases.

## Architecture

```
Cron/Scheduler (RQ-scheduler or manual trigger)
    │
    └─ reconcile_billing_state()
         │
         ├─ 1. Get all orgs with polar_customer_id in plan_metadata
         ├─ 2. For each org: query Polar subscription status
         ├─ 3. Compare local plan tier + effective_until with Polar status
         ├─ 4. Log discrepancies
         ├─ 5. Auto-fix safe cases (active on Polar but trial locally)
         └─ 6. Create ActivityEvent for audit trail
```

## Related Code Files

**Create:**
- `backend/app/services/billing_reconciliation.py` — reconciliation logic

**Modify:**
- RQ worker config — register reconciliation task (or use management command)

## Implementation Steps

### 6.1 Create reconciliation service

File: `backend/app/services/billing_reconciliation.py`

```python
"""Periodic reconciliation between FlowGrid plan state and Polar subscriptions."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.logging import get_logger
from app.core.time import utcnow

logger = get_logger(__name__)


@dataclass
class ReconciliationResult:
    """Summary of a single org reconciliation."""
    organization_id: UUID
    local_tier: str
    polar_status: str | None
    discrepancy: str | None  # None = in sync
    action_taken: str | None


async def reconcile_organization(
    session: AsyncSession,
    *,
    organization_id: UUID,
    polar_customer_id: str,
) -> ReconciliationResult:
    """Compare single org plan state with Polar subscription."""
    from app.services.entitlements import get_or_create_organization_plan
    from app.services.polar_client import get_polar_client

    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    client = get_polar_client()

    # Query Polar for active subscriptions
    try:
        subscriptions = await client.customer_portal.subscriptions.list_async(
            customer_id=polar_customer_id,
        )
    except Exception as exc:
        logger.warning("Polar API error for org %s: %s", organization_id, exc)
        return ReconciliationResult(
            organization_id=organization_id,
            local_tier=plan.tier,
            polar_status=None,
            discrepancy=f"polar_api_error: {exc}",
            action_taken=None,
        )

    # Find active subscription (if any)
    polar_sub = None
    for sub in (subscriptions.result or []):
        if getattr(sub, "status", None) == "active":
            polar_sub = sub
            break

    polar_status = getattr(polar_sub, "status", "none") if polar_sub else "none"

    # Compare states
    discrepancy = None
    action_taken = None

    if polar_status == "active" and plan.tier != "pro":
        discrepancy = f"polar=active but local={plan.tier}"
        # Auto-fix: upgrade to pro (safe — user is paying)
        plan.tier = "pro"
        plan.effective_until = None
        plan.updated_at = utcnow()
        session.add(plan)
        await session.commit()
        action_taken = "auto_upgraded_to_pro"
        logger.warning("RECONCILIATION: Org %s auto-upgraded. %s", organization_id, discrepancy)

    elif polar_status == "none" and plan.tier == "pro":
        discrepancy = f"polar=none but local=pro"
        # DO NOT auto-downgrade — flag for manual review
        action_taken = "flagged_for_review"
        logger.warning("RECONCILIATION: Org %s needs review. %s", organization_id, discrepancy)

    elif polar_status == "canceled" and plan.tier == "pro" and plan.effective_until is None:
        discrepancy = "polar=canceled but local pro has no expiry"
        # Parse period end from Polar subscription
        period_end_raw = getattr(polar_sub, "current_period_end", None)
        if period_end_raw:
            from app.services.billing_webhook_service import _parse_datetime
            period_end = _parse_datetime(str(period_end_raw))
            if period_end:
                plan.effective_until = period_end
                plan.updated_at = utcnow()
                session.add(plan)
                await session.commit()
                action_taken = f"set_effective_until={period_end.isoformat()}"
        if not action_taken:
            action_taken = "flagged_for_review"
        logger.warning("RECONCILIATION: Org %s canceled fix. %s", organization_id, discrepancy)

    return ReconciliationResult(
        organization_id=organization_id,
        local_tier=plan.tier,
        polar_status=polar_status,
        discrepancy=discrepancy,
        action_taken=action_taken,
    )


async def reconcile_all(session: AsyncSession) -> list[ReconciliationResult]:
    """Reconcile all orgs with Polar billing data."""
    from sqlalchemy import select, text
    from app.models.organization_plans import OrganizationPlan

    # Find all orgs with polar_customer_id in metadata
    stmt = select(OrganizationPlan).where(
        OrganizationPlan.plan_metadata.isnot(None)
    )
    result = await session.exec(stmt)
    plans = result.all()

    results = []
    for plan in plans:
        meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
        billing = meta.get("billing", {})
        customer_id = billing.get("polar_customer_id") if isinstance(billing, dict) else None

        if not customer_id:
            continue

        result = await reconcile_organization(
            session,
            organization_id=plan.organization_id,
            polar_customer_id=customer_id,
        )
        results.append(result)

        # Rate limit: avoid hammering Polar API
        await asyncio.sleep(0.5)

    # Log summary
    discrepancies = [r for r in results if r.discrepancy]
    logger.info(
        "Reconciliation complete: %d orgs checked, %d discrepancies",
        len(results),
        len(discrepancies),
    )
    return results
```

### 6.2 Register as RQ task or management command

Option A — RQ scheduled task (preferred if RQ-scheduler available):
```python
# In worker configuration, schedule nightly at 03:00 UTC
scheduler.schedule(
    scheduled_time=datetime.utcnow(),
    func=reconcile_all_sync,
    interval=6 * 3600,  # every 6 hours
)
```

Option B — Management command for manual/cron trigger:
```python
# backend/app/cli/reconcile.py
async def main():
    async with get_async_session() as session:
        results = await reconcile_all(session)
        for r in results:
            if r.discrepancy:
                print(f"  DRIFT: {r.organization_id} — {r.discrepancy} → {r.action_taken}")
```

### 6.3 Add admin API endpoint (optional)

```python
@router.post("/reconcile", dependencies=[Depends(require_org_admin)])
async def trigger_reconciliation(session):
    """Manual reconciliation trigger for admin/support."""
    results = await reconcile_all(session)
    discrepancies = [r for r in results if r.discrepancy]
    return {"total": len(results), "discrepancies": len(discrepancies)}
```

## Todo List

- [ ] 6.1 Create `billing_reconciliation.py`
- [ ] 6.2 Add `reconcile_organization` + `reconcile_all` functions
- [ ] 6.3 Register as RQ scheduled task or management command
- [ ] 6.4 (Optional) Add admin API endpoint
- [ ] 6.5 Compile check

## Success Criteria

- Job queries all orgs with Polar billing data
- Compares local plan tier with Polar subscription status
- Auto-upgrades when Polar says active but local says trial (safe)
- Flags for review when Polar says none but local says pro (unsafe)
- Fixes missing `effective_until` for canceled subscriptions
- Rate-limited to avoid Polar API hammering
- Logging sufficient for audit trail

## Risk Assessment

- **Medium risk**: Auto-upgrade is safe (user paid). Auto-downgrade is NOT done (flagged only).
- **Polar API rate limits**: 0.5s sleep between orgs. For >100 orgs, may need batching.
- **Polar API method**: Verify `customer_portal.subscriptions.list_async` exists in SDK. May need `subscriptions.list` instead.

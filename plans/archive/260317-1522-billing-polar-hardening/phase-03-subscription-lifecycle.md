---
phase: 3
status: pending
priority: P0
effort: L
depends_on: [2]
---

# Phase 3: Subscription Lifecycle Handling

## Context
- BUG-3: `subscription.canceled` ignores `current_period_end` → infinite pro access
- BUG-4: `subscription.uncanceled` not handled → paying user blocked
- **RED-TEAM FINDING-01 (CRITICAL)**: `_trial_expired` and `_subscription_status` only check `trial_7d` tier — pro tier with `effective_until` is NEVER blocked
- **RED-TEAM FINDING-05 (HIGH)**: Out-of-order webhook events can corrupt state
- **RED-TEAM FINDING-12 (MEDIUM)**: Old subscription cancellation can overwrite active new subscription
- Missing: `subscription.updated` for renewals, lifecycle field storage
- [Polar Cross-Reference Report](../reports/brainstorm-260317-1515-polar-cross-reference-deep-review.md)
- [Red Team Review](./reports/red-team-review.md)

## Overview

Fix subscription lifecycle handling to match Polar's event model. **PREREQUISITE**: Fix entitlements expiry check to apply to ALL tiers (not just trial). Store subscription state locally. Handle all critical subscription events. Add event ordering protection.

## Key Insights

Polar Subscription model fields (from docs):
- `status`: active | canceled | revoked
- `current_period_end`: when billing period ends
- `canceled_at`: when user canceled
- `started_at`: subscription start
- `ends_at`: scheduled end
- `ended_at`: actual end
- `cancel_at_period_end`: boolean

Polar event lifecycle:
```
subscription.created → subscription.active → subscription.updated (renewals)
                                                    │
                                           subscription.canceled
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                           subscription.uncanceled  │    subscription.revoked
                           (user reactivates)       │    (payment failed / period end)
                                                    │
                                              (period ends naturally)
```

## Related Code Files

**Modify:**
- `backend/app/services/entitlements.py` — **CRITICAL: fix `_trial_expired` and `_payment_blocked_error`**
- `backend/app/services/billing.py` — fix `_subscription_status`
- `backend/app/services/billing_webhook_service.py` — new handlers + event ordering

## Implementation Steps

### 3.0 [CRITICAL] Fix plan expiry check for ALL tiers (RED-TEAM FINDING-01)

**This is the PREREQUISITE for everything else in Phase 3.**

File: `backend/app/services/entitlements.py`

**Current** (BROKEN for pro tier):
```python
def _trial_expired(*, tier: PlanTier, plan: OrganizationPlan, now: datetime) -> bool:
    if tier != "trial_7d":
        return False  # ❌ Pro tier NEVER expires even with past effective_until
    return plan.effective_until is not None and plan.effective_until <= now
```

**After** (check ALL tiers):
```python
def _plan_expired(*, tier: PlanTier, plan: OrganizationPlan, now: datetime) -> bool:
    """Check if plan has expired based on effective_until, regardless of tier."""
    return plan.effective_until is not None and plan.effective_until <= now
```

Also update `_payment_blocked_error` message to be tier-agnostic:
```python
def _payment_blocked_error(*, tier: PlanTier, effective_until: datetime | None) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "blocked_for_payment",
            "message": "Subscription has expired. Upgrade or renew to continue.",
            "plan": tier,
            "effective_until": effective_until.isoformat() if effective_until else None,
        },
    )
```

Update caller in `_resolve_policy_for_runtime`:
```python
# Line 534: rename call
if _plan_expired(tier=tier, plan=plan, now=now):
    # Update event type to be generic
    record_activity(
        session,
        event_type="saas.plan.expired.blocked",  # was: saas.trial.expired.blocked
        ...
    )
```

**Also** update `billing.py` `_subscription_status`:
```python
# BEFORE:
def _subscription_status(*, tier: str, effective_until: datetime | None) -> SubscriptionStatus:
    if tier == "trial_7d" and effective_until is not None and effective_until <= now:
        return "blocked_for_payment"
    return "active"

# AFTER:
def _subscription_status(*, tier: str, effective_until: datetime | None) -> SubscriptionStatus:
    now = utcnow()
    if effective_until is not None and effective_until <= now:
        return "blocked_for_payment"
    return "active"
```

### 3.1 Expand `plan_metadata.billing` schema (convention only)

Store Polar subscription lifecycle fields in existing `plan_metadata` JSON:
```python
"billing": {
    # existing
    "polar_subscription_id": "sub_xxx",
    "polar_customer_id": "cus_xxx",
    "last_checkout_mode": "polar",
    "last_checkout_at": "2024-01-01T...",
    # NEW fields
    "polar_subscription_status": "active",        # active|canceled|revoked
    "polar_current_period_end": "2024-02-01T...", # ISO datetime
    "polar_canceled_at": null,                     # ISO datetime or null
    "polar_started_at": "2024-01-01T...",         # ISO datetime
    "polar_event_timestamp": "2024-01-01T...",    # last processed event timestamp (for ordering)
}
```

No migration needed — JSON column is schemaless.

### 3.2 Add event timestamp guard (RED-TEAM FINDING-05)

File: `backend/app/services/billing_webhook_service.py`

Add ordering protection to prevent out-of-order event processing:
```python
def _should_process_event(
    plan: OrganizationPlan, event_timestamp_raw: Any
) -> bool:
    """Reject events older than the last processed event for this subscription."""
    event_ts = _parse_datetime(event_timestamp_raw)
    if event_ts is None:
        return True  # No timestamp = always process (safe fallback)

    meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = meta.get("billing", {})
    last_ts_raw = billing.get("polar_event_timestamp") if isinstance(billing, dict) else None
    last_ts = _parse_datetime(last_ts_raw)

    if last_ts is None:
        return True  # No previous timestamp = always process

    return event_ts >= last_ts  # Only process newer or same-time events
```

All handlers call this before modifying state:
```python
async def _handle_subscription_canceled(session, *, organization_id, event_data):
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)

    # Ordering guard
    event_timestamp = _safe_get(event_data, "modified_at") or _safe_get(event_data, "canceled_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale event for org %s", organization_id)
        return

    # ... rest of handler
    # Store timestamp after processing
    _update_billing_metadata(plan, {"polar_event_timestamp": str(event_timestamp)})
```

### 3.3 Add subscription ID validation (RED-TEAM FINDING-12)

Prevent old subscription events from overwriting active new subscription:
```python
def _is_current_subscription(plan: OrganizationPlan, event_data: Any) -> bool:
    """Check if event is for the current subscription (not an old one)."""
    event_sub_id = str(_safe_get(event_data, "id") or "")
    if not event_sub_id:
        return True  # No sub ID = process anyway

    meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = meta.get("billing", {})
    stored_sub_id = billing.get("polar_subscription_id") if isinstance(billing, dict) else None

    if not stored_sub_id:
        return True  # No stored sub = process anyway

    return event_sub_id == stored_sub_id
```

Apply in cancellation/revocation handlers (don't apply in `subscription.active` which sets new sub):
```python
# In _handle_subscription_canceled, _handle_subscription_revoked:
if not _is_current_subscription(plan, event_data):
    logger.warning("Ignoring event for old subscription %s, current is %s",
                   _safe_get(event_data, "id"), stored_sub_id)
    return
```

### 3.4 Fix `_handle_subscription_canceled` (BUG-3)

```python
async def _handle_subscription_canceled(
    session, *, organization_id, event_data
) -> None:
    """Subscription canceled — keep pro until period end, schedule expiry."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()

    # Ordering guard
    event_timestamp = _safe_get(event_data, "modified_at") or _safe_get(event_data, "canceled_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale canceled event for org %s", organization_id)
        return

    # Subscription ID guard
    if not _is_current_subscription(plan, event_data):
        logger.warning("Ignoring canceled event for old subscription, org %s", organization_id)
        return

    # Extract current_period_end from Polar event data
    current_period_end_raw = _safe_get(event_data, "current_period_end")
    canceled_at_raw = _safe_get(event_data, "canceled_at")

    # Parse period end — this is when pro access should stop
    current_period_end = _parse_datetime(current_period_end_raw)
    if current_period_end and current_period_end > now:
        plan.effective_until = current_period_end  # Pro until period end
    else:
        plan.effective_until = now  # Fallback: block immediately

    _update_billing_metadata(plan, {
        "polar_subscription_status": "canceled",
        "polar_canceled_at": canceled_at_raw,
        "polar_current_period_end": current_period_end_raw,
        "polar_event_timestamp": str(event_timestamp),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()

    logger.info("Org %s subscription canceled, pro until %s", organization_id, plan.effective_until)
```

**Critical dependency**: Step 3.0 MUST be done first. Without it, `effective_until` on pro tier is ignored by entitlements.

### 3.5 Add `_handle_subscription_uncanceled` (BUG-4)

```python
async def _handle_subscription_uncanceled(
    session, *, organization_id, event_data
) -> None:
    """Subscription re-activated after cancellation — restore pro."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()

    plan.tier = "pro"
    plan.effective_until = None  # Pro has no expiry
    _update_billing_metadata(plan, {
        "polar_subscription_status": "active",
        "polar_canceled_at": None,
        "polar_event_timestamp": str(
            _safe_get(event_data, "modified_at") or now.isoformat()
        ),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()

    logger.info("Org %s subscription uncanceled, pro restored", organization_id)
```

### 3.6 Add `_handle_subscription_updated`

```python
async def _handle_subscription_updated(
    session, *, organization_id, event_data
) -> None:
    """Subscription updated (renewals, plan changes) — sync state."""
    plan = await get_or_create_organization_plan(session, organization_id=organization_id)
    now = utcnow()

    event_timestamp = _safe_get(event_data, "modified_at")
    if not _should_process_event(plan, event_timestamp):
        logger.info("Skipping stale updated event for org %s", organization_id)
        return

    polar_status = _safe_get(event_data, "status")
    current_period_end_raw = _safe_get(event_data, "current_period_end")

    if polar_status == "active":
        plan.tier = "pro"
        plan.effective_until = None
    elif polar_status == "canceled":
        current_period_end = _parse_datetime(current_period_end_raw)
        if current_period_end:
            plan.effective_until = current_period_end

    _update_billing_metadata(plan, {
        "polar_subscription_status": polar_status,
        "polar_current_period_end": current_period_end_raw,
        "polar_event_timestamp": str(event_timestamp),
    })
    plan.updated_at = now
    session.add(plan)
    await session.commit()

    logger.info("Org %s subscription updated, status=%s", organization_id, polar_status)
```

### 3.7 Update existing `_handle_subscription_active`

Add lifecycle field storage + event timestamp:
```python
# Inside existing _handle_subscription_active, after setting plan.tier = "pro":
_update_billing_metadata(plan, {
    "polar_subscription_status": "active",
    "polar_started_at": _safe_get(event_data, "started_at"),
    "polar_current_period_end": _safe_get(event_data, "current_period_end"),
    "polar_canceled_at": None,
    "polar_event_timestamp": str(
        _safe_get(event_data, "modified_at") or utcnow().isoformat()
    ),
})
```

### 3.8 Update `_handle_subscription_revoked`

Add metadata update + subscription ID guard:
```python
# Add at top of handler:
if not _is_current_subscription(plan, event_data):
    logger.warning("Ignoring revoked event for old subscription, org %s", organization_id)
    return

# Add before commit:
_update_billing_metadata(plan, {
    "polar_subscription_status": "revoked",
    "polar_canceled_at": _safe_get(event_data, "canceled_at"),
    "polar_event_timestamp": str(
        _safe_get(event_data, "modified_at") or utcnow().isoformat()
    ),
})
```

### 3.9 Add helper functions

```python
def _parse_datetime(raw: Any) -> datetime | None:
    """Parse ISO datetime string from Polar event data."""
    if not raw or not isinstance(raw, str):
        return None
    try:
        from datetime import timezone
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except (ValueError, TypeError):
        return None


def _update_billing_metadata(plan: OrganizationPlan, updates: dict[str, Any]) -> None:
    """Merge updates into plan_metadata.billing without losing existing fields."""
    existing_meta = plan.plan_metadata if isinstance(plan.plan_metadata, dict) else {}
    billing = existing_meta.get("billing")
    existing_billing = billing if isinstance(billing, dict) else {}
    plan.plan_metadata = {
        **existing_meta,
        "billing": {**existing_billing, **updates},
    }
```

### 3.10 Update HANDLED_EVENTS and _HANDLERS

```python
HANDLED_EVENTS = {
    "subscription.active",
    "subscription.revoked",
    "subscription.canceled",
    "subscription.uncanceled",   # NEW
    "subscription.updated",      # NEW
    "order.paid",
}

_HANDLERS = {
    "subscription.active": _handle_subscription_active,
    "subscription.revoked": _handle_subscription_revoked,
    "subscription.canceled": _handle_subscription_canceled,
    "subscription.uncanceled": _handle_subscription_uncanceled,  # NEW
    "subscription.updated": _handle_subscription_updated,        # NEW
    "order.paid": _handle_order_paid,
}
```

## Todo List

- [ ] **3.0 [CRITICAL] Fix `_trial_expired` → `_plan_expired` in entitlements.py**
- [ ] **3.0b Fix `_subscription_status` in billing.py — check all tiers**
- [ ] 3.1 Add `_parse_datetime`, `_update_billing_metadata` helpers
- [ ] 3.2 Add `_should_process_event` ordering guard
- [ ] 3.3 Add `_is_current_subscription` validation
- [ ] 3.4 Fix `_handle_subscription_canceled` — parse `current_period_end`, set `effective_until`
- [ ] 3.5 Add `_handle_subscription_uncanceled` handler
- [ ] 3.6 Add `_handle_subscription_updated` handler
- [ ] 3.7 Update `_handle_subscription_active` — store lifecycle fields
- [ ] 3.8 Update `_handle_subscription_revoked` — store metadata + sub ID guard
- [ ] 3.9 Update `HANDLED_EVENTS` and `_HANDLERS` maps
- [ ] 3.10 Compile check all 3 modified files

## Success Criteria

- **`_plan_expired` checks ALL tiers** — pro with past `effective_until` returns blocked
- `subscription.canceled` sets `effective_until = current_period_end` from Polar
- `subscription.uncanceled` restores pro with no expiry
- `subscription.updated` syncs status and period end
- Out-of-order events rejected via timestamp guard
- Old subscription events don't overwrite active subscription
- All handlers store lifecycle fields in `plan_metadata.billing`
- Existing `subscription.active` and `subscription.revoked` behavior preserved
- No DB migration needed (JSON metadata)

## Risk Assessment

- **High impact, medium risk**: Directly affects user access rights
- **Step 3.0 is BLOCKING**: Without it, the entire Phase 3 cancellation flow is broken
- **Mitigation**: Parse failures fallback to safe behavior (log + skip or block immediately)
- **Edge case**: `current_period_end` missing from event → fallback to immediate block
- **Backward compat**: `_plan_expired` change affects trial too — verify existing trial flow still works (trial always has `effective_until`, so behavior unchanged)
- **Testing**: Must test all event type × state combinations including out-of-order scenarios

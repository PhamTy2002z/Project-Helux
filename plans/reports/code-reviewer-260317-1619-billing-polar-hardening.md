# Code Review: Billing & Polar Integration Hardening

**Branch:** `fix/billing-polar-hardening`
**Reviewer:** code-reviewer
**Date:** 2026-03-17
**Base:** `main`

---

## Scope

- **Modified files (8):** `polar_client.py`, `billing_webhooks.py`, `billing_webhook_service.py`, `billing.py`, `entitlements.py`, `queue_worker.py`, `models/__init__.py`, `CONTRIBUTING.md` (deleted)
- **New files (6):** `polar_webhook_events.py`, `billing_webhook_helpers.py`, `billing_webhook_queue.py`, `billing_webhook_worker.py`, `billing_reconciliation.py`, migration `c3d4e5f6a7b8`
- **Total LOC changed:** ~337 added, ~156 removed
- **Focus:** Webhook reliability, subscription lifecycle, concurrency, reconciliation

---

## Overall Assessment

**Solid hardening pass.** The store-then-process pattern, row-level locking, timestamp-based event ordering, and subscription ID validation are well-implemented. Helpers extraction into `billing_webhook_helpers.py` is clean. The code addresses most items from the plan (phases 1-6). However, there are several issues ranging from a **CRITICAL dedup bug** to medium-priority missing handlers and code quality items.

---

## CRITICAL Issues

### C-1: UNIQUE constraint on `polar_event_id` allows NULL duplicates (dedup bypass)

**File:** `backend/app/models/polar_webhook_events.py` line 21, `billing_webhooks.py` line 64

The dedup logic relies on `UniqueConstraint("polar_event_id")` catching `IntegrityError`. However:

1. PostgreSQL UNIQUE constraints allow **multiple NULL values**. If `polar_event_id` is empty string or None (which happens when `event_data.id` is missing), every such event will insert successfully — no dedup.
2. Line 64 of `billing_webhooks.py`: `str(_safe_get(event_data, "id") or "") or None` converts empty string to `None`, but does NOT prevent multiple `None` rows from being inserted.

**Impact:** Events without an `id` field (malformed or non-subscription events) bypass dedup entirely, potentially causing duplicate processing.

**Fix options:**
- (A) Use a partial unique index: `CREATE UNIQUE INDEX ... ON polar_webhook_events(polar_event_id) WHERE polar_event_id IS NOT NULL;`
- (B) Generate a fallback dedup key (e.g., SHA256 of raw body) when `polar_event_id` is missing.
- (C) Reject storage of events with no `polar_event_id` (simplest, but loses audit trail for unknown events).

Recommended: **(B)** — hash the raw body bytes as fallback to guarantee dedup for all events.

```python
import hashlib
polar_event_id = str(_safe_get(event_data, "id") or "")
if not polar_event_id:
    polar_event_id = f"hash-{hashlib.sha256(body).hexdigest()}"
```

---

## HIGH Priority Issues

### H-1: `subscription.past_due` event not handled

**File:** `billing_webhook_service.py` HANDLED_EVENTS set

Polar SDK v0.30.1 (installed) emits `subscription.past_due` events. This event fires when payment fails but subscription hasn't been revoked yet. Not handling it means:
- No warning to users when payment is past due
- No metadata update tracking past_due status
- Reconciliation cannot distinguish between "active" and "past_due"

**Fix:** Add handler that sets `polar_subscription_status: "past_due"` in metadata and optionally enqueues a warning email.

### H-2: `_handle_subscription_active` does not call `_should_process_event` or `_is_current_subscription`

**File:** `billing_webhook_service.py` lines 41-87

The `active` handler is the only subscription handler that skips both timestamp guard and subscription ID validation. An out-of-order re-delivery of an old `subscription.active` event for a previous subscription could incorrectly restore pro access after the org was legitimately downgraded.

**Fix:** Add the same guards used in `canceled`/`revoked`/`updated`:
```python
event_timestamp = _safe_get(event_data, "modified_at")
if not _should_process_event(plan, event_timestamp):
    return
```

### H-3: `_handle_subscription_uncanceled` lacks timestamp guard

**File:** `billing_webhook_service.py` lines 185-208

Same issue as H-2. No `_should_process_event` check. A replayed `uncanceled` event could restore pro access after a later `revoked` event was processed.

### H-4: Metrics hardcoded event type mismatch

**File:** `backend/app/api/metrics.py` line 53

The entitlements module now emits `"saas.plan.expired.blocked"` but the metrics module still queries for `"saas.trial.expired.blocked"`. This breaks the billing health metrics dashboard — trial-blocked count will always be 0.

```python
# metrics.py still has:
TRIAL_BLOCKED_EVENT_TYPE = "saas.trial.expired.blocked"
# Should be:
TRIAL_BLOCKED_EVENT_TYPE = "saas.plan.expired.blocked"
```

**Also affects:** `backend/tests/api/test_metrics_tenant_dimensions.py` line 79 (same hardcoded string).

### H-5: `billing_webhook_service.py` exceeds 200-line limit (339 lines)

**File:** `billing_webhook_service.py`

Per project code standards, files should stay under 200 lines. At 339 lines this file is significantly over. The handlers are already well-structured — consider splitting into `billing_webhook_handlers.py` (individual handlers) and keeping `billing_webhook_service.py` as the dispatch/entry-point module.

### H-6: Webhook endpoint returns 200 OK even when Redis enqueue fails

**File:** `billing_webhooks.py` lines 97-101

```python
enqueue_billing_webhook_task(webhook_event_id=webhook_event.id)
return {"status": "accepted"}
```

If `enqueue_billing_webhook_task` returns `False` (Redis down), the endpoint still returns `accepted`. The event is stored but will never be processed unless manually triggered. The caller (Polar) won't retry because it got 200.

**Fix:** Check return value; if False, log an error. The event is safely stored so a background sweep can pick it up — but add that sweep mechanism or at least log at ERROR level.

---

## MEDIUM Priority Issues

### M-1: `get_or_create_organization_plan` commits inside `_get_plan_for_update` transaction

**File:** `billing_webhook_helpers.py` lines 74-79

```python
async def _get_plan_for_update(session, *, organization_id):
    await get_or_create_organization_plan(session, organization_id=organization_id)  # commits!
    return await get_organization_plan_for_update(session, organization_id=organization_id)
```

`get_or_create_organization_plan` does `session.commit()` internally (line 161 of entitlements.py). This releases any existing transaction lock. Then `get_organization_plan_for_update` acquires a new FOR UPDATE lock. Between the commit and the re-lock, another concurrent request could modify the plan. This is a small race window but technically violates the atomicity the FOR UPDATE is meant to provide.

**Fix:** Consider using `session.flush()` instead of `session.commit()` in the create path, or use INSERT ... ON CONFLICT DO NOTHING to avoid the separate commit.

### M-2: Reconciliation queries all subscriptions instead of filtering by customer

**File:** `billing_reconciliation.py` lines 45-47

```python
subscriptions = await client.subscriptions.list_async(
    organization_id=None,  # search all
)
```

This fetches ALL subscriptions from Polar, then loops to find the matching customer. For a growing number of subscriptions, this is O(n) on every org reconciliation and will hit API rate limits. The Polar SDK `subscriptions.list_async` supports a `customer_id` parameter.

**Fix:**
```python
subscriptions = await client.subscriptions.list_async(
    customer_id=polar_customer_id,
)
```

### M-3: Missing `subscription.created` in HANDLED_EVENTS

**File:** `billing_webhook_service.py`

Polar SDK v0.30.1 emits `subscription.created` when a new subscription is created (before it becomes active). While `subscription.active` handles the main activation, not storing/acknowledging `subscription.created` means no audit trail for the creation event.

### M-4: `_handle_subscription_canceled` does not retain `plan.tier = "pro"` explicitly

**File:** `billing_webhook_service.py` lines 145-182

The handler sets `effective_until` but never explicitly sets `plan.tier`. If the plan was already `trial_7d` (from a previous revoke) and a stale `canceled` event arrives, `effective_until` gets updated on the wrong tier. The `_is_current_subscription` guard helps but only if subscription_id is stored.

### M-5: `raw_payload` serialization swallows errors silently

**File:** `billing_webhooks.py` lines 67-77

The broad `except Exception` on serialization means if `model_dump` or `__dict__` serialization fails, `raw_payload` will be `{"type": "...", "data": {}}` — an empty data dict. The event gets stored but `process_stored_event` will process an empty payload, leading to silent data loss.

**Fix:** At minimum, log at WARNING level (currently DEBUG). Consider storing the raw body bytes as a fallback.

### M-6: `billing_reconciliation.py` modifies plan without FOR UPDATE lock

**File:** `billing_reconciliation.py` lines 75-80, 97-101

The reconciliation auto-upgrades and sets `effective_until` without acquiring a row-level lock, while the webhook handlers use FOR UPDATE. This creates a potential race between webhook processing and reconciliation running concurrently.

### M-7: `queue_worker.py` import ordering

**File:** `queue_worker.py` lines 41-43

The billing webhook imports are placed between the `queue` import and the `webhooks` import, breaking the alphabetical/grouped import convention used in the rest of the file. isort may flag this.

---

## LOW Priority Issues

### L-1: `_HANDLERS` type annotation uses `dict[str, Any]` instead of proper callable type

**File:** `billing_webhook_service.py` line 271

```python
_HANDLERS: dict[str, Any] = { ... }
```

Could be typed as `dict[str, Callable[..., Awaitable[None]]]` for better type safety.

### L-2: `_handle_checkout_updated` does not store any data

**File:** `billing_webhook_service.py` lines 248-257

The handler only logs. No checkout status tracking in DB. Acceptable for now but means failed/expired checkouts have no queryable audit trail.

### L-3: `CONTRIBUTING.md` deleted without apparent reason

The diff shows `CONTRIBUTING.md` was deleted. This may be intentional (unrelated cleanup) but should be in a separate commit for clean git history.

### L-4: `billing.py` exceeds 200 lines (313 lines)

Already over the limit before this PR. Not introduced by this change but worth noting.

---

## Edge Cases Found by Scout

1. **NULL `polar_event_id` bypasses UNIQUE constraint** (escalated to C-1)
2. **Metrics event type string mismatch** (`saas.trial.expired.blocked` vs `saas.plan.expired.blocked`) — dashboard breaks silently (escalated to H-4)
3. **`process_polar_event` legacy path is now dead code** — the webhook endpoint no longer calls it (store-then-process replaced it). It remains as a "legacy sync path" but nothing invokes it. Consider removing or deprecating explicitly.
4. **Test `test_trial_expired_blocks_runtime_actions`** — test still passes since the behavior is identical (just function rename). However, the test name suggests trial-only blocking which no longer matches the broader semantics.
5. **`_plan_expired` now blocks pro orgs with `effective_until` set** — this is the CRITICAL F-01 fix and is correct. But if a webhook delay causes `effective_until` to be set on a pro plan (e.g., canceled event processed) and then the uncanceled event is delayed, pro users could be temporarily blocked. The timestamp guard mitigates this but H-3 (missing guard on uncanceled) weakens the protection.

---

## Positive Observations

1. **Store-then-process pattern** is well-implemented — webhook receiver is fast (store + enqueue) and processing happens async with retry.
2. **`_update_billing_metadata` helper** eliminates the previous copy-paste metadata merge logic across all handlers.
3. **`_should_process_event` timestamp guard** is a clean solution for out-of-order event rejection.
4. **`_is_current_subscription` check** prevents stale events for old subscriptions from corrupting current plan state.
5. **Row-level locking via `get_organization_plan_for_update`** properly prevents concurrent plan mutations.
6. **Idempotent billing history** via `idem_key` in the active handler is correct.
7. **Polar client now has timeout and sandbox support** — proper production hardening.
8. **Customer reuse (BUG-7 fix)** in `create_checkout_session` with `customer_id` / `external_customer_id` fallback is correct.
9. **Portal session now includes `return_url`** — fixing BUG-6.
10. **Migration is backward-compatible** — new table only, no existing schema changes.

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix NULL dedup bypass in `polar_event_id` UNIQUE constraint (C-1)
2. **[HIGH]** Add timestamp guard to `_handle_subscription_active` and `_handle_subscription_uncanceled` (H-2, H-3)
3. **[HIGH]** Fix metrics event type constant from `saas.trial.expired.blocked` to `saas.plan.expired.blocked` (H-4)
4. **[HIGH]** Handle `subscription.past_due` event (H-1)
5. **[HIGH]** Log error when Redis enqueue fails (H-6)
6. **[HIGH]** Split `billing_webhook_service.py` to stay under 200 lines (H-5)
7. **[MEDIUM]** Fix reconciliation to query by `customer_id` instead of fetching all (M-2)
8. **[MEDIUM]** Add FOR UPDATE lock in reconciliation writes (M-6)
9. **[MEDIUM]** Address `_get_plan_for_update` commit-then-lock race (M-1)
10. **[MEDIUM]** Improve serialization error logging (M-5)

---

## Metrics

| Metric | Value |
|--------|-------|
| Critical Issues | 1 |
| High Issues | 6 |
| Medium Issues | 7 |
| Low Issues | 4 |
| Files > 200 LOC | 2 (`billing_webhook_service.py`: 339, `billing.py`: 313) |
| New DB tables | 1 (`polar_webhook_events`) |
| Test coverage | Phase 7 (testing) not yet implemented |

---

## Unresolved Questions

1. **Is `process_polar_event` (legacy sync path) still needed?** Nothing calls it after the webhook endpoint was switched to store-then-process. Should it be removed or kept for manual/CLI usage?
2. **Should `subscription.created` be stored for audit even if not processed?** Currently silently ignored.
3. **What triggers the reconciliation job?** No cron/scheduler registration found — `reconcile_all` exists but nothing calls it periodically.
4. **Should the `_plan_expired` rename be reflected in the operations playbook?** `docs/operations/billing-simulated-incident-playbook.md` still references the old event type string.

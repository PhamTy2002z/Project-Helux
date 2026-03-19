# Red Team Review: Billing & Polar Integration Hardening Plan

**Date:** 2026-03-17
**Reviewer:** Adversarial Review (Red Team)
**Plan:** plans/260317-1522-billing-polar-hardening/
**Verdict:** Plan is STRUCTURALLY SOUND but has 6 critical/high gaps that must be addressed before implementation.

---

## Executive Summary

The plan correctly identifies real bugs and proposes reasonable fixes. The store-then-process webhook architecture and reconciliation job are good engineering. However, the plan has blind spots in: (1) a Pro-tier expiry logic bomb from effective_until misuse, (2) webhook deduplication race, (3) the async processing model conflicting with the existing queue infrastructure, (4) missing rollback strategy, (5) subscription.updated event ordering hazard, and (6) reconciliation job using wrong API endpoint.

---

## Findings

### FINDING-01: Pro-Tier Expiry Logic Bomb via effective_until
**Severity:** CRITICAL
**Plan addresses:** NO

**Problem:** The `_trial_expired` function in `entitlements.py` (line 102-105) only blocks access when tier is trial_7d. It returns False for pro tier, meaning pro users with a past `effective_until` are NEVER blocked. The `_subscription_status` in `billing.py` has the SAME blind spot.

Phase 3 sets `plan.effective_until = current_period_end` on `subscription.canceled` while keeping tier = pro. When the period ends, the user STILL has full pro access because no code path checks `effective_until` for pro-tier plans. The plan assumes the entitlements service will auto-block but this is **FALSE** based on the actual code.

**Impact:** Canceled users retain pro access indefinitely. The exact bug this plan claims to fix (BUG-3) will STILL exist.

**Fix:** Extend `_trial_expired` / `_subscription_status` to check `effective_until` for ALL tiers (rename to `_plan_expired`).

---

### FINDING-02: Webhook Deduplication Race Condition
**Severity:** HIGH | **Plan addresses:** PARTIALLY

**Problem:** Receiver does NOT check for duplicate `polar_event_id` before inserting. Polar retries create duplicates. Both get enqueued.

**Fix:** Add UNIQUE constraint on `polar_event_id`. Use INSERT ON CONFLICT DO NOTHING.

---

### FINDING-03: Async Processing Model Mismatch
**Severity:** HIGH | **Plan addresses:** NO

**Problem:** Existing queue uses `Callable[[QueuedTask], Awaitable[None]]` handlers. Plan shows wrong interface. Steps 2.4-2.6 lack detail.

**Fix:** Provide explicit QueuedTask wrapper and _TASK_HANDLERS registration code.

---

### FINDING-04: No Migration Rollback Strategy
**Severity:** MEDIUM | **Plan addresses:** NO

**Problem:** Sync-to-async change has no rollback playbook.

**Fix:** Add WEBHOOK_ASYNC env var fallback. Document event replay procedure.

---

### FINDING-05: Out-of-Order Event Delivery Not Handled
**Severity:** HIGH | **Plan addresses:** NO

**Problem:** If `subscription.uncanceled` arrives before `subscription.canceled` (out of order), user who should have pro gets scheduled for expiry. No timestamp comparison or transition validation exists.

**Fix:** Add last-event-timestamp guard using `modified_at` field. Add status transition validation.

---

### FINDING-06: Reconciliation Uses Wrong API Endpoint
**Severity:** MEDIUM | **Plan addresses:** NO

**Problem:** Uses customer portal API instead of server-side `client.subscriptions.list()`.

**Fix:** Use server-side API. Verify against SDK source.

---

### FINDING-07: get_or_create Race in Locking
**Severity:** MEDIUM | **Plan addresses:** PARTIALLY

Two-step create-then-lock has race window. Concurrent new-org handlers crash with IntegrityError. Fix: add conflict handling.

---

### FINDING-08: plan_metadata JSON Corruption
**Severity:** MEDIUM | **Plan addresses:** PARTIALLY

Full-JSON replacement can overwrite token usage data written outside FOR UPDATE lock. Fix: use `jsonb_set` or document limitation.

---

### FINDING-09: checkout.updated Missing org_id
**Severity:** LOW | **Plan addresses:** YES

Correctly handled by early-return. Lower log level to debug.

---

### FINDING-10: Reconciliation Loop Error Isolation
**Severity:** MEDIUM | **Plan addresses:** NO

One org failure aborts entire function. Fix: per-org try/except with 429 backoff.

---

### FINDING-11: Email Enqueue After Async Switch
**Severity:** LOW | **Plan addresses:** NO

Task-enqueuing-task pattern. Worker crash loses email. Best-effort already.

---

### FINDING-12: Multiple Subscriptions per Org
**Severity:** MEDIUM | **Plan addresses:** NO

Old subscription cancellation overwrites active new subscription. Fix: check `polar_subscription_id` in handlers.

---

### FINDING-13: customer_id Type Safety
**Severity:** LOW | **Plan addresses:** NO

SDK may return UUID object. Fix: force string conversion.

---

### FINDING-14: Free-Tier Orgs in Reconciliation
**Severity:** LOW | **Plan addresses:** YES

Correctly skips orgs without Polar data.

---

### FINDING-15: SDK Param Verification Deferred
**Severity:** MEDIUM | **Plan addresses:** PARTIALLY

No verification step exists. Fix: add Phase 0 with `inspect.signature` calls.

---

## Summary Table

| # | Finding | Severity | Plan Covers? | Phase |
|---|---------|----------|-------------|-------|
| 01 | Pro-tier expiry logic bomb | **CRITICAL** | NO | 3 |
| 02 | Webhook dedup race | **HIGH** | PARTIAL | 2 |
| 03 | Queue infra mismatch | **HIGH** | NO | 2 |
| 04 | No rollback strategy | MEDIUM | NO | 2 |
| 05 | Out-of-order events | **HIGH** | NO | 3 |
| 06 | Wrong reconciliation API | MEDIUM | NO | 6 |
| 07 | Create-then-lock race | MEDIUM | PARTIAL | 5 |
| 08 | JSON metadata corruption | MEDIUM | PARTIAL | 3,5 |
| 09 | checkout.updated org_id | LOW | YES | 4 |
| 10 | Reconciliation isolation | MEDIUM | NO | 6 |
| 11 | Email enqueue async | LOW | NO | 2,3 |
| 12 | Multiple subscriptions | MEDIUM | NO | 3 |
| 13 | customer_id type | LOW | NO | 3 |
| 14 | Free-tier reconciliation | LOW | YES | 6 |
| 15 | SDK param verification | MEDIUM | PARTIAL | 1 |

## Blocking Findings (Must Fix Before Implementation)

1. **FINDING-01** (CRITICAL): Without fixing `_trial_expired` and `_subscription_status` to check pro-tier `effective_until`, the entire Phase 3 cancellation flow is broken.

2. **FINDING-05** (HIGH): Out-of-order events cause state corruption. Need timestamp guard.

3. **FINDING-02** (HIGH): Webhook dedup must be implemented, not just mentioned.

## Recommended Plan Changes

1. Add **Phase 3.0**: Fix expiry checks for ALL tiers. Prerequisite for Phase 3.
2. Add **Phase 2 Step 2.3a**: UNIQUE constraint + ON CONFLICT dedup.
3. Add **Phase 2 Steps 2.4-2.6**: Explicit QueuedTask code matching queue_worker.py patterns.
4. Add **Phase 3 Step 3.9**: Event timestamp guard.
5. Add **Phase 3 Step 3.10**: Subscription ID validation.
6. Add **Rollback Playbook** to Phase 2.
7. Add **Phase 0**: SDK parameter verification.

---

## Overall Assessment

The plan identifies real problems and proposes reasonable solutions. The architecture (store-then-process, reconciliation, row locking) is sound. But it has one CRITICAL gap (Finding-01) that would cause the exact bug it claims to fix to persist, plus three HIGH gaps (Findings 02, 03, 05) that need attention. The remaining findings are medium/low and can be addressed during implementation.

**Recommendation:** Fix Finding-01 and Finding-05 in the plan before starting implementation. Address the rest during development.

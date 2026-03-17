---
status: done
scope: P0 + P1 + Infrastructure
priority: critical
estimated_phases: 7
branch: fix/billing-polar-hardening
---

# Billing & Polar Integration Hardening

## Problem Statement

Cross-reference review giữa Polar SDK docs và FlowGrid implementation phát hiện **7 bugs**, **9 missing webhook events**, và **thiếu infrastructure** cho webhook reliability, reconciliation, và concurrency safety.

**Reports**:
- [Brainstorm: Payment System Review](../reports/brainstorm-260317-1507-payment-billing-review.md)
- [Deep Review: Polar Cross-Reference](../reports/brainstorm-260317-1515-polar-cross-reference-deep-review.md)

## Scope

| Category | Items | Priority |
|----------|-------|----------|
| P0 Bugs | BUG-2 (env), BUG-3 (canceled), BUG-4 (uncanceled), BUG-7 (customer_id) | Critical |
| P1 Bugs | BUG-1 (validate_event), BUG-5 (exception), BUG-6 (return_url) | High |
| P1 Features | subscription.updated, checkout.updated, lifecycle field storage | High |
| Infrastructure | Webhook event storage, async processing, reconciliation, row-level locking | High |

## Phase Overview

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Polar Client Foundation](./phase-01-polar-client-foundation.md) | done | P0 | S |
| 2 | [Webhook Infrastructure](./phase-02-webhook-infrastructure.md) | done | P0 | M |
| 3 | [Subscription Lifecycle](./phase-03-subscription-lifecycle.md) | done | P0 | L |
| 4 | [Checkout & Portal](./phase-04-checkout-portal-improvements.md) | done | P1 | M |
| 5 | [Concurrency & Locking](./phase-05-concurrency-locking.md) | done | P1 | S |
| 6 | [Reconciliation Job](./phase-06-reconciliation-job.md) | done | P1 | M |
| 7 | [Testing](./phase-07-testing.md) | done | P1 | L |

## Dependency Graph

```
Phase 1 (client fix) ──┐
                        ├──► Phase 2 (webhook infra) ──► Phase 3 (lifecycle)
                        │                                      │
                        ├──► Phase 4 (checkout) ◄──────────────┘
                        │                                      │
                        └──► Phase 5 (locking) ◄───────────────┘
                                                               │
                                    Phase 6 (reconciliation) ◄─┘
                                                               │
                                    Phase 7 (testing) ◄────────┘
```

## Key Constraints

- **No breaking API changes** — frontend contract preserved
- **Backward-compatible migrations** — nullable new columns, new tables only
- **Polar SDK >= 0.18.0** — verify parameter names before changing
- **Existing entitlements logic untouched** — only webhook/billing layer changes
- **BILLING_MODE=simulated** path must remain functional

## Red-Team Review

[Full report](./reports/red-team-review.md) — 15 findings, 1 CRITICAL, 3 HIGH. All incorporated into plan:

| Finding | Severity | Resolution |
|---------|----------|------------|
| F-01: Pro-tier expiry never checked | **CRITICAL** | Phase 3 Step 3.0: `_trial_expired` → `_plan_expired` |
| F-02: Webhook dedup race | **HIGH** | Phase 2: UNIQUE constraint + IntegrityError |
| F-03: Queue interface mismatch | **HIGH** | Phase 2: Explicit QueuedTask/worker/registration code |
| F-05: Out-of-order events | **HIGH** | Phase 3 Step 3.2: Event timestamp guard |
| F-04: No rollback strategy | MEDIUM | Phase 2: Rollback strategy section added |
| F-06: Wrong reconciliation API | MEDIUM | Phase 6: Verify correct SDK method |
| F-07: Create-then-lock race | MEDIUM | Phase 5: IntegrityError handling |
| F-08: JSON metadata corruption | MEDIUM | Phase 3: Merge-only metadata updates |
| F-10: Reconciliation isolation | MEDIUM | Phase 6: Per-org try/except |
| F-12: Multiple subscriptions | MEDIUM | Phase 3 Step 3.3: Subscription ID validation |

## Success Criteria

1. All 7 identified bugs fixed with tests
2. **`_plan_expired` checks ALL tiers** (CRITICAL F-01 fix)
3. Webhook events stored before processing (store-then-process) with dedup
4. `subscription.canceled` sets `effective_until = current_period_end`
5. `subscription.uncanceled` restores pro access
6. Out-of-order events rejected via timestamp guard
7. Existing Polar customer reused on repeat checkout
8. Nightly reconciliation detects state drift
9. Row-level locking prevents concurrent plan corruption
10. All existing tests pass + new tests for each fix

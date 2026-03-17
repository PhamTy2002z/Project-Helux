---
phase: 7
status: pending
priority: P1
effort: L
depends_on: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Testing

## Context
- Payment system is high-stakes — requires comprehensive test coverage
- Need to test all webhook event types, edge cases, and failure scenarios
- Existing test patterns in `backend/tests/`

## Overview

Write unit + integration tests for all phases. Focus on: webhook event processing, idempotency, concurrency, reconciliation, and edge cases.

## Related Code Files

**Create:**
- `backend/tests/services/test_billing_webhook_handlers.py`
- `backend/tests/services/test_billing_reconciliation.py`
- `backend/tests/services/test_billing_checkout.py`
- `backend/tests/api/test_billing_webhooks_api.py`

**Reference:**
- Existing test patterns in `backend/tests/`

## Test Matrix

### 7.1 Webhook Handler Tests (`test_billing_webhook_handlers.py`)

| Test Case | Event Type | Expected |
|-----------|-----------|----------|
| Active → pro upgrade | `subscription.active` | tier=pro, effective_until=None, metadata stored |
| Revoked → trial block | `subscription.revoked` | tier=trial_7d, effective_until=now, status=revoked |
| Canceled → scheduled expiry | `subscription.canceled` | tier=pro, effective_until=current_period_end |
| Canceled with no period_end | `subscription.canceled` | effective_until=now (fallback) |
| Uncanceled → restore pro | `subscription.uncanceled` | tier=pro, effective_until=None |
| Updated (renewal) | `subscription.updated` | status synced, period_end updated |
| Updated (canceled status) | `subscription.updated` | effective_until set from period_end |
| Order paid | `order.paid` | Log only, no state change |
| Checkout updated | `checkout.updated` | Log only, no state change |
| Missing org_id in metadata | any | Handler skipped, log warning |
| Invalid org_id format | any | Handler skipped, log warning |
| Duplicate event (idempotent) | `subscription.active` | Second call is no-op |

### 7.2 Webhook Infrastructure Tests (`test_billing_webhooks_api.py`)

| Test Case | Expected |
|-----------|----------|
| Valid signature → 200 + event stored | PolarWebhookEvent created with status=pending |
| Invalid signature → 400 | No event stored |
| Provider != polar → 404 | Webhook endpoint disabled |
| Event stored even if processing fails | status=failed, error_message set |

### 7.3 Checkout Tests (`test_billing_checkout.py`)

| Test Case | Expected |
|-----------|----------|
| First checkout → external_customer_id set | Polar called with external_customer_id=org_id |
| Repeat checkout → customer_id reused | Polar called with existing customer_id |
| Portal session → return_url included | return_url points to /settings |
| Simulated checkout idempotency | Duplicate key returns idempotent_replay=True |

### 7.4 Reconciliation Tests (`test_billing_reconciliation.py`)

| Test Case | Expected |
|-----------|----------|
| Polar active, local trial | Auto-upgrade to pro |
| Polar none, local pro | Flagged for review (no auto-downgrade) |
| Polar canceled, local pro no expiry | effective_until set from period_end |
| Polar active, local pro | No change (in sync) |
| Polar API error | Logged, no state change |

### 7.5 Concurrency Tests

| Test Case | Expected |
|-----------|----------|
| Two concurrent webhooks same org | Both serialize via FOR UPDATE lock |
| Concurrent checkout + webhook | No plan corruption |

## Implementation Notes

- Use `pytest` + `pytest-asyncio`
- Mock Polar SDK calls (don't hit real API in tests)
- Use DB transactions with rollback for isolation
- For concurrency tests, use `asyncio.gather()` with multiple coroutines

## Todo List

- [ ] 7.1 Write webhook handler unit tests (12 cases)
- [ ] 7.2 Write webhook infrastructure tests (4 cases)
- [ ] 7.3 Write checkout tests (4 cases)
- [ ] 7.4 Write reconciliation tests (5 cases)
- [ ] 7.5 Write concurrency tests (2 cases)
- [ ] 7.6 Run full test suite + verify all pass
- [ ] 7.7 Check test coverage for billing modules

## Success Criteria

- All 27+ test cases pass
- No existing tests broken
- Billing modules have >80% test coverage
- Edge cases (missing metadata, parse failures, concurrent access) covered

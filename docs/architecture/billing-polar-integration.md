# Billing & Polar Integration Architecture

## Overview

VisgniteAI integrates with Polar for real subscription payments with webhook-driven lifecycle management. The architecture uses a **store-then-process pattern** for webhooks to ensure:
- Audit trail of all Polar events
- Replay capability on worker failures
- No duplicate processing (idempotency)
- Reliable state transitions

## Webhook Architecture (Store-Then-Process)

### Webhook Receiver Flow

```
Polar sends webhook → POST /webhooks/polar
    ↓
1. Validate Polar signature (HMAC-SHA256)
2. Extract event_type, event_id, organization_id (from metadata)
3. Store raw payload in polar_webhook_events table (idempotent by event_id)
4. Return 200 immediately to Polar
5. Enqueue async worker job
```

### Async Worker Processing

```
RQ Worker picks up job from queue
    ↓
1. Load polar_webhook_event record from database
2. Route to handler by event_type
3. Acquire row-level lock on organization_plans (SELECT FOR UPDATE)
4. Update plan tier, effective_until, metadata
5. Create billing_checkout_attempts record (only on confirmed payment)
6. Enqueue email notifications (non-blocking)
7. Commit transaction
```

### Idempotency Guarantees

**Webhook Event Level** (via `polar_webhook_events`):
- Unique constraint on `event_id` prevents duplicate storage
- Worker can safely re-process same event_id without duplicates

**Billing History Level** (via `billing_checkout_attempts`):
- Created ONLY on `subscription.active` event
- Keyed by `(organization_id, idempotency_key)` where key = `polar-sub-{subscription_id}`
- Prevents duplicate records on webhook replay

**Concurrency Safety**:
- `SELECT FOR UPDATE` row-level lock acquired before modifying organization_plans
- Prevents race conditions between concurrent webhook handlers for same org

## Supported Polar Events

| Event Type | Handler | Action |
|------------|---------|--------|
| `subscription.active` | `_handle_subscription_active` | tier=pro, effective_until=None, create history |
| `subscription.canceled` | `_handle_subscription_canceled` | effective_until=current_period_end |
| `subscription.uncanceled` | `_handle_subscription_uncanceled` | tier=pro, effective_until=None |
| `subscription.updated` | `_handle_subscription_updated` | sync status and period end |
| `subscription.past_due` | `_handle_subscription_past_due` | warn user, keep pro |
| `subscription.revoked` | `_handle_subscription_revoked` | tier=trial_7d (immediate block) |
| `checkout.updated` | `_handle_checkout_updated` | audit log only |
| `order.paid` | `_handle_order_paid` | audit log only |

## Plan Expiry Check (Critical Fix)

**Old behavior**: Only checked trial tier expiry
**New behavior**: Checks ALL tiers when `effective_until` is set

```python
def _plan_expired(*, tier: PlanTier, plan: OrganizationPlan, now: datetime) -> bool:
    """Check if plan has expired based on effective_until, regardless of tier."""
    return plan.effective_until is not None and plan.effective_until <= now
```

**Impact**:
- Pro tier orgs with `effective_until` set (via revoked/canceled events) are blocked
- Metric emitted: `saas.plan.expired.blocked` (renamed from `saas.trial.expired.blocked`)
- Returns 402 `blocked_for_payment` with plan state in response

## Database Schema

### Table: polar_webhook_events

```sql
CREATE TABLE polar_webhook_events (
    id UUID PRIMARY KEY,
    event_id VARCHAR UNIQUE NOT NULL,  -- Polar event ID for idempotency
    event_type VARCHAR NOT NULL INDEX,  -- subscription.active, checkout.updated, etc.
    organization_id UUID NULLABLE INDEX FK organizations.id,
    raw_payload JSONB NOT NULL,
    processed_at TIMESTAMP NULLABLE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Audit trail + replay log for all Polar events

### Table: organization_plans (Enhanced)

```sql
-- Existing columns
- id UUID PRIMARY KEY
- organization_id UUID UNIQUE FK organizations.id
- tier VARCHAR (trial_7d, pro)
- effective_from TIMESTAMP
- effective_until TIMESTAMP NULLABLE  -- Set when plan expires (revoked/canceled)
- metadata JSONB  -- Polar integration state

-- New metadata keys:
{
  "last_checkout_mode": "polar",
  "last_checkout_at": "2026-03-16T14:30:00Z",
  "polar_subscription_id": "sub_...",
  "polar_customer_id": "cus_...",
  "polar_subscription_status": "active|canceled|revoked|past_due",
  "polar_started_at": "2026-03-16T00:00:00Z",
  "polar_current_period_end": "2026-04-16T00:00:00Z",
  "polar_canceled_at": null,
  "polar_event_timestamp": "2026-03-16T14:30:00Z"
}
```

### Table: billing_checkout_attempts (Renamed)

Tracks successful plan transitions via Polar webhooks.

```sql
CREATE TABLE billing_checkout_attempts (
    id UUID PRIMARY KEY,
    organization_id UUID FK organizations.id INDEX,
    idempotency_key VARCHAR INDEX,  -- polar-sub-{subscription_id}
    requested_plan_tier VARCHAR,
    resolved_plan_tier VARCHAR,
    status VARCHAR (succeeded, failed),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, idempotency_key)
);
```

**Purpose**: Immutable billing history; used for idempotency and audit trail

## Polar Client Configuration

### Environment Variables

```bash
# Checkout & API calls
POLAR_API_KEY=<key>

# Webhook validation
POLAR_WEBHOOK_SECRET=<secret>

# Server environment
POLAR_SERVER=production|sandbox

# Feature flag
PAYMENT_PROVIDER=polar
BILLING_MODE=provider
```

### Client Initialization

```python
from app.services.polar_client import get_polar_client

client = get_polar_client()
# Internally:
# - Passes server param based on POLAR_SERVER
# - Uses API key from POLAR_API_KEY
# - Sets 10-second timeout on all requests
```

### Key Features

**Timeout**: 10 seconds (prevents hanging requests)

**Server routing**: Sandbox for dev, Production for prod

**Customer reuse**: When creating checkout for existing customer, Polar customer_id is passed to enable portal return_url (user can manage subscription after checkout)

## Email Notifications

Events trigger async email jobs:

| Event | Email Type | Trigger |
|-------|-----------|---------|
| `subscription.active` | `upgrade_confirmed` | Payment succeeded, user upgraded |
| `subscription.past_due` | `payment_failed` | Payment failed, account at risk |
| `subscription.revoked` | `payment_failed` | Payment revoked, account blocked |

Jobs are enqueued non-blocking via `enqueue_billing_email()`.

## Reconciliation & State Checking

**Reconciliation service** (`billing_reconciliation.py`):
- Detects state drift between Polar API and VisgniteAI database
- Reports mismatches (e.g., pro tier but no polar_subscription_id in metadata)
- Can be run ad-hoc to validate data consistency

**Health endpoint** (`GET /api/v1/metrics/saas-billing-health`):
- Exposes plan_expired_block_count, checkout_failure_ratio_pct
- Used for alerting and monitoring

## Concurrency Guarantees

### SELECT FOR UPDATE

When modifying organization_plans:
```python
plan = await get_organization_plan_for_update(session, organization_id=org_id)
# Acquires row-level lock, prevents concurrent modifications
```

### Use Case
- Multiple webhook handlers for same org (shouldn't happen but safe)
- Concurrent checkout attempts (blocked after first one)
- Manual plan updates + webhook handlers

## Backward Compatibility

API contracts remain stable:
- `GET /api/v1/billing/me/subscription` still returns same schema
- `POST /api/v1/billing/checkout` accepts same params
- Only internal implementation changes (simulated → real provider)

Metric renamed:
- Old: `saas.trial.expired.blocked`
- New: `saas.plan.expired.blocked` (applies to all tiers)

---

## Unresolved Questions

1. Should we implement billing reconciliation job (daily cron)?
2. What's the SLA for webhook processing latency?
3. Should we expose webhook delivery/replay logs in admin UI?

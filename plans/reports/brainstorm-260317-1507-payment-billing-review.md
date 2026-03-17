# Payment, Billing & Subscription System Review

## Context

FlowGrid SaaS platform. Two billing modes: `simulated` (v1) and `provider` (Polar integration). Two tiers: `trial_7d` → `pro`. Token quota enforcement via OpenClaw gateway sync.

**Files reviewed**: `billing.py`, `billing_webhooks.py`, `billing_webhook_service.py`, `entitlements.py`, `agent_token_quota_service.py`, `organization_plans.py`, `billing_checkout_attempts.py`, `polar_client.py`, `billing_email*.py`, `config.py`, schemas, frontend components.

---

## 1. Security

### Current State
- ✅ Polar webhook signature verification (`polar_sdk.webhooks.validate_event()`)
- ✅ Org-scoped data isolation (all queries filtered by `organization_id`)
- ✅ Admin-only write endpoints (checkout, portal session)
- ✅ Member-only read endpoints (subscription, history)
- ✅ Secrets in env vars (standard practice)

### Gaps & Risks
- ⚠️ **No rate limiting** on checkout endpoint — attacker can spam checkout requests
- ⚠️ **No IP/user-agent logging** on checkout attempts — no fraud detection capability
- ⚠️ **No webhook secret rotation** mechanism — compromised secret = permanent vulnerability
- ⚠️ **Idempotency key client-controlled** (4-128 chars) — client can forge/predict keys
- ⚠️ **Polar customer/subscription IDs** stored in plain JSON `plan_metadata` — no encryption at rest
- ⚠️ **No HMAC signing** on simulated checkout idempotency keys

### Recommendations
1. Add rate limiting: 5 checkout attempts / org / 10 min
2. Log IP + user-agent on all billing mutations for fraud trail
3. Implement webhook secret rotation (dual-secret validation during rotation window)
4. Server-side idempotency key generation (UUID v4) instead of client-provided
5. Encrypt sensitive fields in `plan_metadata` (customer_id, subscription_id)

---

## 2. Failure Handling

### Current State
- ✅ `IntegrityError` caught on duplicate checkout → returns existing record
- ✅ Trial expiry → HTTP 402 `blocked_for_payment`
- ✅ Quota exceeded → HTTP 429 with resource details
- ✅ Webhook missing org_id → logs warning, returns gracefully
- ✅ Unsupported provider → HTTP 501

### Gaps & Risks
- ❌ **No circuit breaker** for Polar API calls — if Polar is down, checkout hangs
- ❌ **No timeout configuration** on Polar SDK calls (`checkouts.create_async`, `customer_sessions.create_async`)
- ❌ **No fallback** when Polar checkout creation fails — user sees raw 500
- ❌ **No dead-letter queue** for failed webhook processing
- ⚠️ **Email enqueue failure** silently swallowed — user never gets confirmation email

### Recommendations
1. Add explicit timeout (10s) on all Polar SDK calls
2. Implement circuit breaker pattern (after 3 consecutive Polar failures, return 503 with retry-after)
3. Wrap Polar API errors in friendly user-facing messages
4. Add DLQ for failed webhook events — manual retry capability
5. Log email enqueue failures as WARNING with alert trigger

---

## 3. Idempotency / Duplicate Prevention

### Current State
- ✅ **Simulated mode**: `(organization_id, idempotency_key)` unique constraint on `BillingCheckoutAttempt`
- ✅ **IntegrityError retry**: catches DB constraint violation, returns existing record with `idempotent_replay=true`
- ✅ **Polar webhook**: dedup via `polar-sub-{subscription_id}` key
- ✅ **Email delivery**: deterministic idempotency key `{org_id}:{invite_id}:{attempt}`

### Gaps & Risks
- ⚠️ **Provider checkout** (`create_checkout_session`) has **NO local idempotency record** — if Polar returns checkout URL but DB write fails, we lose reference
- ⚠️ **No TTL on idempotency keys** — table grows unbounded
- ⚠️ **Webhook idempotency** only checks BillingCheckoutAttempt — if webhook arrives but plan update fails mid-transaction, replay won't re-apply plan change
- ⚠️ **Race window** between IntegrityError catch and retry — concurrent requests may both fail

### Recommendations
1. **Critical**: Write `BillingCheckoutAttempt` with status `pending` BEFORE calling Polar API, update to `succeeded` after
2. Add TTL cleanup job for old idempotency records (>90 days)
3. Make webhook processing fully idempotent: check plan state before applying, not just BillingCheckoutAttempt existence
4. Use `SELECT ... FOR UPDATE` or advisory locks for concurrent checkout protection

---

## 4. Concurrency / Conflict Handling

### Current State
- ✅ IntegrityError catch for duplicate checkout attempts
- ✅ Single plan per org (unique constraint on `organization_id` in OrganizationPlan)

### Gaps & Risks
- ❌ **No row-level locking** on OrganizationPlan during updates — two webhooks arriving simultaneously could produce inconsistent state
- ❌ **No optimistic concurrency** (no version/etag column on OrganizationPlan)
- ⚠️ **Token quota sync** (`sync_and_enforce`) reads and writes without locking — concurrent agent executions may exceed quota
- ⚠️ **Webhook handler** doesn't use `SELECT FOR UPDATE` when reading plan before updating

### Recommendations
1. Add `version` column to OrganizationPlan for optimistic locking
2. Use `SELECT ... FOR UPDATE` in webhook handler when updating plan
3. Add `SELECT ... FOR UPDATE` in token quota sync to prevent double-spend
4. Consider pessimistic locking for checkout flow (lock org during checkout)

---

## 5. Rollback / Compensation Handling

### Current State
- ✅ Simulated checkout: single transaction (plan + history created atomically)
- ✅ Polar `subscription.revoked`: sets `effective_until=now` (downgrades immediately)

### Gaps & Risks
- ❌ **No compensation for failed Polar checkout** — if Polar checkout created but user never pays, no cleanup
- ❌ **No refund handling** — no endpoint or logic for processing refunds
- ❌ **No proration logic** — tier changes are binary (trial → pro), no mid-cycle handling
- ❌ **No plan downgrade path** — once `pro`, no mechanism to revert to trial
- ⚠️ **Webhook `subscription.canceled`**: only logs, doesn't set future expiry date — pro access continues indefinitely?

### Anti-patterns
- **Inconsistent cancellation handling**: `subscription.canceled` logs but doesn't schedule downgrade. Should set `effective_until = current_period_end` to honor paid period but block renewal.

### Recommendations
1. On `subscription.canceled`: store `effective_until = current_period_end` from Polar event data
2. Add compensation job: scan `BillingCheckoutAttempt` with status `pending` older than 1h → mark `expired`
3. Design refund webhook handler for Polar `order.refunded` event
4. Add plan downgrade endpoint for admin manual override

---

## 6. Audit Log / Traceability

### Current State
- ✅ ActivityEvent records: checkout succeeded/failed, trial blocked, upgrade modal open
- ✅ Request ID tracking in event payload
- ✅ Admin audit trail with actor context
- ✅ Support timeline endpoint (`/support/timeline?request_id=...`)

### Gaps & Risks
- ⚠️ **Webhook events NOT audited** — no ActivityEvent for incoming webhooks (subscription.active, order.paid, etc.)
- ⚠️ **No before/after state capture** — audit log records action but not what changed (e.g., old tier → new tier)
- ⚠️ **No immutable audit log** — ActivityEvents table is regular SQL, can be modified/deleted
- ⚠️ **Token quota enforcement actions** not recorded as billing events

### Recommendations
1. **Critical**: Log all webhook events as ActivityEvents with full payload (redact sensitive fields)
2. Add `previous_tier` and `new_tier` to checkout/webhook audit events
3. Consider append-only audit table with write-only permissions
4. Log quota enforcement decisions (block/allow) as ActivityEvents

---

## 7. Source of Truth / State Consistency

### Current State
- ✅ `OrganizationPlan` is the single source of truth for plan tier
- ✅ `BillingCheckoutAttempt` is the billing history ledger
- ✅ `agent_token_daily_usage` is the token quota ledger

### Gaps & Risks
- ❌ **Dual source of truth problem**: OrganizationPlan says `pro`, but Polar subscription may be canceled/expired — no periodic reconciliation
- ❌ **No Polar subscription status field** stored locally — can't detect drift without API call
- ⚠️ **Token usage depends on OpenClaw gateway** — if gateway is down, ledger stale, quota not enforced
- ⚠️ **`plan_metadata.billing`** stores Polar IDs but no subscription status — stale metadata possible

### Anti-patterns
- **Trust-but-no-verify**: System trusts webhook as sole update mechanism. If webhook lost, plan state drifts from Polar reality.

### Recommendations
1. **Critical**: Add periodic reconciliation job (every 6h) — query Polar API, compare local plan state
2. Store Polar subscription status (`active`, `canceled`, `past_due`) in `plan_metadata`
3. Add `last_synced_at` timestamp to OrganizationPlan
4. Implement gateway health-aware quota enforcement (degrade gracefully when gateway unreachable)

---

## 8. Webhook Reliability

### Current State
- ✅ Signature verification via `polar_sdk.webhooks.validate_event()`
- ✅ Idempotent processing via subscription ID dedup
- ✅ Unhandled event types gracefully skipped

### Gaps & Risks
- ❌ **No webhook event logging/storage** — can't replay failed webhooks
- ❌ **No webhook delivery tracking** — can't tell if Polar stopped sending webhooks
- ❌ **No ordering guarantee** — `subscription.active` arriving after `subscription.canceled` would re-activate plan
- ❌ **No retry mechanism** — if webhook processing fails (DB down), event is lost forever
- ⚠️ **Synchronous processing** — webhook handler does DB writes inline, slow processing could cause Polar to timeout and retry

### Recommendations
1. **Critical**: Store raw webhook payload in a `webhook_events` table before processing
2. Add `processed_at` timestamp — allows replay of unprocessed events
3. Check event timestamp ordering: reject events older than last processed event for same subscription
4. Move webhook processing to async queue (RQ) — return 200 immediately, process in background
5. Add webhook health monitoring: alert if no webhooks received in 24h

---

## 9. Reconciliation (System ↔ Provider)

### Current State
- ❌ **No reconciliation mechanism exists** — system is purely webhook-driven
- Token usage: syncs from OpenClaw gateway per-request (not periodic)

### Gaps & Risks
- ❌ **Lost webhook = permanent state drift** — no way to detect or recover
- ❌ **No scheduled sync** with Polar subscription status
- ❌ **No billing amount verification** — system doesn't validate payment amounts from Polar
- ❌ **No usage reporting to Polar** — metered billing not implemented (future risk if pricing changes)

### Recommendations
1. **Critical**: Implement nightly reconciliation job:
   - Fetch all active Polar subscriptions
   - Compare with local `OrganizationPlan` records
   - Auto-fix drift (with admin notification)
   - Log discrepancies for audit
2. Store Polar `amount`, `currency` on checkout history for financial reconciliation
3. Add admin dashboard showing reconciliation status and last sync time
4. Implement manual reconciliation trigger endpoint for support team

---

## 10. Entitlement Sync / Access Control

### Current State
- ✅ Real-time quota enforcement on write paths (boards, agents, tasks)
- ✅ Trial expiry → 402 block
- ✅ Token quota enforcement (daily + monthly limits)
- ✅ Two-layer enforcement: cost-based (primary) + token hard-cap (safety net)
- ✅ Board lead grace period logic

### Gaps & Risks
- ⚠️ **Entitlements cached in-memory per request** — no cache invalidation on plan change
- ⚠️ **Plan change propagation is eventual** — webhook updates plan, but running agent sessions aren't notified
- ⚠️ **No entitlement event** when plan changes — frontend doesn't know to refresh until next API call
- ⚠️ **Downgrade doesn't enforce existing resource cleanup** — if user has 3 boards on pro and downgrades to trial (limit: 1), existing boards remain accessible

### Recommendations
1. Emit SSE event on plan tier change → frontend refreshes entitlements immediately
2. Add "soft enforcement" on downgrade: warn but don't delete existing resources; block new creation
3. Document downgrade policy clearly (grandfather existing resources vs hard block)
4. Add entitlement check middleware for read paths (not just write paths) if strict access control needed

---

## 11. Observability / Monitoring / Alerting

### Current State
- ✅ `/api/v1/metrics/saas-billing-health` endpoint (checkout success/failure ratio, trial blocks)
- ✅ Support timeline endpoint for request tracing
- ✅ Incident playbook: `docs/operations/billing-simulated-incident-playbook.md`
- ✅ Structured ActivityEvent logging

### Gaps & Risks
- ❌ **No external monitoring integration** (no Prometheus/Grafana/Datadog metrics export)
- ❌ **No alerting** on critical billing events (checkout failures, webhook failures, reconciliation drift)
- ❌ **No SLI/SLO defined** for billing operations (e.g., checkout latency p99 < 5s)
- ⚠️ **Billing health endpoint** is pull-based — no push-based alerting
- ⚠️ **No webhook latency tracking** — can't measure Polar → FlowGrid delivery time

### Recommendations
1. Define billing SLOs: checkout success rate > 99.5%, webhook processing < 30s
2. Add structured logging with severity levels (ERROR for failures, WARN for anomalies)
3. Implement webhook latency tracking (Polar event timestamp vs processing timestamp)
4. Add cron-based health check: query billing metrics, alert on thresholds
5. Export key metrics to external monitoring (even simple Slack webhook alerts)

---

## Critical Failure Scenarios & Edge Cases

| # | Scenario | Current Handling | Risk Level |
|---|----------|-----------------|------------|
| 1 | Polar webhook lost (network issue) | ❌ No detection/recovery | **CRITICAL** |
| 2 | Double webhook delivery | ✅ Subscription ID dedup | Low |
| 3 | Webhook arrives out of order (canceled before active) | ❌ No ordering check | **HIGH** |
| 4 | Polar API down during checkout | ❌ Raw 500 error | **HIGH** |
| 5 | User pays on Polar but webhook never arrives | ❌ User stuck on trial | **CRITICAL** |
| 6 | Concurrent checkout from same org | ✅ IntegrityError catch | Medium |
| 7 | DB down during webhook processing | ❌ Event lost forever | **CRITICAL** |
| 8 | Plan metadata corruption | ⚠️ No validation on read | Medium |
| 9 | Token quota gateway unreachable | ⚠️ Observe mode fallback | Medium |
| 10 | User cancels on Polar portal, system doesn't update | ⚠️ `subscription.canceled` only logs | **HIGH** |
| 11 | Trial expiry during active agent run | ✅ Blocks next run, not current | Low |
| 12 | Multiple orgs with same Polar customer | ⚠️ No constraint validation | Medium |

---

## Anti-patterns Identified

### 1. Fire-and-Forget Webhooks
**Problem**: Webhook handler processes inline → returns 200 → no record of raw event. If processing fails after signature verification, event is permanently lost.
**Fix**: Store-then-process pattern. Store raw webhook → return 200 → process async.

### 2. Provider as Sole State Driver
**Problem**: Local plan state 100% dependent on webhooks. No reconciliation = no safety net.
**Fix**: Periodic reconciliation + stored Polar subscription status.

### 3. Client-Controlled Idempotency Keys
**Problem**: Simulated checkout accepts client-provided idempotency keys. Malicious client can predict/reuse keys.
**Fix**: Server-generated idempotency keys (UUID v4). Client provides intent, server generates dedup key.

### 4. Log-Only Cancellation
**Problem**: `subscription.canceled` webhook only logs — doesn't schedule plan expiry. Pro access may continue indefinitely.
**Fix**: Set `effective_until = current_period_end` on cancellation.

### 5. Synchronous Webhook Processing
**Problem**: Webhook handler does DB writes inline. Slow processing → Polar timeout → retry → potential duplicate processing.
**Fix**: Queue-based processing. Return 200 immediately, process in background.

---

## Priority Improvement Roadmap

### P0 — Must Fix (Data Loss / Revenue Risk)
1. **Webhook event storage** — store raw payload before processing
2. **Reconciliation job** — nightly sync with Polar API
3. **Cancellation handling** — set `effective_until` on cancel webhook
4. **Webhook async processing** — queue-based, not inline

### P1 — Should Fix (Reliability)
5. **Polar API circuit breaker + timeout** — prevent cascading failures
6. **Webhook ordering** — timestamp-based ordering check
7. **Row-level locking** — `SELECT FOR UPDATE` on plan updates
8. **Audit log enrichment** — webhook events, before/after state

### P2 — Nice to Have (Operational Excellence)
9. **Rate limiting** on checkout endpoints
10. **External monitoring/alerting** integration
11. **Server-side idempotency keys**
12. **Entitlement change SSE events**

---

## Unresolved Questions

1. What is the expected monthly webhook volume from Polar? (sizing for webhook_events table)
2. Is Polar sandbox vs production webhook behavior identical? (testing strategy)
3. Should downgraded users keep existing resources or be hard-blocked?
4. What's the acceptable reconciliation drift window? (6h? 24h?)
5. Is there a plan to support multiple payment providers simultaneously?
6. Should refund processing trigger automatic plan downgrade?

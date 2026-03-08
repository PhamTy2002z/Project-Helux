# Billing simulated incident playbook

Use this runbook for incidents in SaaS v1 simulated billing flows:

- Upgrade modal opens but checkout fails
- Trial expired block applied unexpectedly
- Checkout failure ratio spikes

## Required inputs

- `organization_id`
- `request_id` from `X-Request-Id`
- Time window in UTC

## 1. Check billing health metrics

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8000/api/v1/metrics/saas-billing-health?range_key=24h" | jq
```

Focus fields:

- `checkout_failure_ratio_pct`
- `trial_blocked_rate_pct`
- `checkout_failure_count`

## 2. Pull support timeline by request id

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8000/api/v1/billing/support/timeline?request_id=<request-id>" | jq
```

Expected event types:

- `saas.billing.simulated.upgrade_modal_open`
- `saas.billing.simulated.checkout_succeeded`
- `saas.billing.simulated.checkout_failed`
- `saas.trial.expired.blocked`

## 3. Confirm organization plan state

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/v1/billing/me/subscription | jq
```

Check:

- `plan_tier`
- `status`
- `effective_until`

## 4. Decision matrix

- High `checkout_failure_ratio_pct` + no trial blocks:
  - Suspect checkout endpoint issues; verify billing mode and idempotency collisions.
- High `trial_blocked_rate_pct`:
  - Verify trial expiry timestamps and tenant plan assignment.
- Empty timeline for valid request id:
  - Validate request-id propagation and API gateway header forwarding.

## 5. Alert suggestion (baseline)

Start with this alert while beta traffic is small:

- Trigger when `checkout_failure_ratio_pct > 15` for `15m`
- Trigger when `trial_blocked_count` jumps > `2x` normal baseline

## Escalation package

- Incident summary
- `organization_id`
- `request_id`
- `/metrics/saas-billing-health` response
- `/billing/support/timeline` response

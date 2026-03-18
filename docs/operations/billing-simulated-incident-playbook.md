# Billing & Polar Integration Incident Playbook

Use this runbook for incidents in SaaS v1 Polar billing flows:

- Polar webhook not received or processed
- Plan not upgraded after successful Polar checkout
- Pro tier blocked unexpectedly (plan expired)
- Trial expiry block applied incorrectly
- Duplicate billing history records

## Required inputs

- `organization_id`
- `request_id` from `X-Request-Id` (if applicable)
- `event_id` from Polar webhook (if applicable)
- Time window in UTC

## 1. Check for Polar webhook in event table

```bash
psql -U postgres -d visgniteai -c "
SELECT id, event_id, event_type, organization_id, processed_at, created_at
FROM polar_webhook_events
WHERE created_at > (NOW() - INTERVAL '1 hour')
ORDER BY created_at DESC
LIMIT 20;
"
```

Check:
- Is webhook event present? If missing, Polar may not have sent it (check Polar dashboard).
- Is `processed_at` populated? If NULL, worker hasn't processed it yet or failed.

## 2. Confirm organization plan state

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/v1/billing/me/subscription | jq
```

Check:
- `plan_tier` — should be `pro` after successful Polar webhook
- `effective_until` — should be null for active subscriptions, set only for canceled/revoked
- `metadata.polar_subscription_status` — `active`, `canceled`, `revoked`, `past_due`

## 3. Check billing health metrics

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8000/api/v1/metrics/saas-billing-health?range_key=24h" | jq
```

Focus fields:
- `checkout_failure_ratio_pct` — should be < 5%
- `plan_expired_block_rate_pct` — metric renamed from `trial_blocked_rate_pct`
- `plan_expired_block_count`

## 4. Pull support timeline by request id

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  "http://localhost:8000/api/v1/billing/support/timeline?request_id=<request-id>" | jq
```

Expected event types:
- `saas.billing.upgrade_modal_open`
- `saas.billing.checkout_initiated` (Polar)
- `saas.billing.webhook_received` (Polar event stored)
- `saas.plan.expired.blocked` (renamed from `saas.trial.expired.blocked`)

## 5. Check for duplicate billing history

```bash
psql -U postgres -d visgniteai -c "
SELECT idempotency_key, COUNT(*) as count
FROM billing_checkout_attempts
WHERE organization_id = '<org-id>'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
"
```

If duplicates found:
- Check `polar_subscription_id` in organization_plans metadata
- History records are created ONLY on `subscription.active` webhook (idempotent by polar_subscription_id)
- Webhook replays should not create duplicates due to idempotency key constraint

## 6. Decision matrix

- Webhook event missing:
  - Verify Polar account, webhook endpoint registered, signature key correct
  - Check Polar dashboard event log for delivery attempts and failures

- Webhook event stored but `processed_at` NULL:
  - Check RQ worker logs for job failures in `processing` queue
  - Verify database permissions for worker to update records

- Plan tier not updated after webhook:
  - Check if webhook handler executed (logs should show "Org X upgraded to pro via Polar webhook")
  - Verify metadata contains polar_subscription_id (confirms handler ran)

- Pro tier blocked unexpectedly:
  - Check `organization_plans.effective_until` — should be null for active subscriptions
  - If set, check `revoked` or `canceled` events in webhook table

- Duplicate history records:
  - Confirm idempotency key uses polar_subscription_id (should prevent duplicates)
  - Check webhook event processing logs for retries

## 7. Alert suggestion (baseline)

Start with these alerts:

- Trigger when `plan_expired_block_count` > `2x` normal baseline for `15m`
- Trigger when `webhook_processed_lag_sec > 300` (webhook stored but not processed in 5 min)
- Trigger when Polar API errors > 10% of checkout attempts

## Escalation package

- Incident summary
- `organization_id`
- `polar_subscription_id` (from metadata)
- Webhook event ID (if applicable)
- `/metrics/saas-billing-health` response
- `/billing/support/timeline` response
- Relevant rows from `polar_webhook_events` and `billing_checkout_attempts`

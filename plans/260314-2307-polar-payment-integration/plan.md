---
title: "Polar Payment Provider Integration"
description: "Integrate Polar as real payment provider for FlowGrid SaaS billing (checkout + webhooks)"
status: pending
priority: P1
effort: 6h
branch: develop
tags: [billing, polar, payment, saas]
created: 2026-03-14
---

# Polar Payment Provider Integration

## Overview

Add Polar as the first real payment provider alongside existing simulated billing scaffold. When `BILLING_MODE=provider` and `PAYMENT_PROVIDER=polar`, the system creates real Polar checkout sessions and processes webhook events to flip plan tiers.

**Simulated mode remains untouched** -- zero changes to existing dev workflow.

## Architecture

```
BILLING_MODE=simulated  -> existing flow (no change)
BILLING_MODE=provider   -> Polar checkout + webhooks

POST /api/v1/billing/checkout
  -> PolarClient.create_checkout(product_price_id, org_id, email)
  -> returns { checkout_url }
  -> frontend redirects to Polar hosted page

POST /api/v1/billing/webhooks/polar  (unauthenticated, signature-verified)
  -> validate_event(payload, headers, POLAR_WEBHOOK_SECRET)
  -> subscription.active   -> flip plan to "pro"
  -> subscription.revoked  -> flip plan to "trial_7d" (blocked)
  -> subscription.canceled -> log, keep pro until period end
  -> order.paid            -> log checkout attempt
```

## Phases

| # | Phase | Status | Effort | Files |
|---|-------|--------|--------|-------|
| 1 | [Backend Config & Client](./phase-01-backend-config-and-client.md) | pending | 1h | config.py, pyproject.toml, polar_client.py |
| 2 | [Checkout API](./phase-02-checkout-api.md) | pending | 1.5h | billing.py (route), billing schemas, billing service |
| 3 | [Webhook Handler](./phase-03-webhook-handler.md) | pending | 2h | billing_webhooks.py, billing_webhook_service.py |
| 4 | [Frontend Integration](./phase-04-frontend-integration.md) | pending | 1h | billing.ts, upgrade-modal.tsx |
| 5 | [Env & Testing](./phase-05-env-and-testing.md) | pending | 0.5h | .env.example files |

## Dependencies

- Phase 2 depends on Phase 1 (client needed for checkout)
- Phase 3 depends on Phase 1 (client needed for webhook verification)
- Phase 4 depends on Phase 2 (frontend needs checkout endpoint)
- Phase 5 can run in parallel after Phase 3

## Key Decisions

1. **No DB migration** -- reuse existing `organization_plans` + `billing_checkout_attempts` tables
2. **Lazy singleton** for Polar client -- only initialized when `BILLING_MODE=provider`
3. **Webhook endpoint is unauthenticated** -- uses Polar signature verification instead
4. **Frontend redirect** to Polar hosted checkout (no embedded UI)
5. **snake_case filenames** for new backend files: `polar_client.py`, `billing_webhooks.py`, `billing_webhook_service.py`

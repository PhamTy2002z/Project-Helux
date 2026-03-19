# Billing V1 Scope

## Goals
- Ship a SaaS subscription model with trial and paid tiers, with deterministic quota enforcement.
- Integrate with Polar for real payment processing with webhook-driven subscription lifecycle.
- Store webhook events before processing for audit trail and replay capability.

## In Scope
- Plans: `trial_7d`, `pro`.
- Trial default on org creation (`7 days`), then runtime is blocked when expired.
- Real Polar checkout API:
  - `POST /api/v1/billing/checkout` (Polar-hosted checkout or portal)
  - `GET /api/v1/billing/me/subscription`
- Polar webhook receiver with store-then-process pattern:
  - `POST /webhooks/polar` (signature validated, event stored, processed async)
  - Supported events: subscription.active|canceled|uncanceled|updated|past_due|revoked
  - Async worker processes events and updates organization_plans
- Plan expiry blocks ALL tiers (pro + trial) when `effective_until` set
- Row-level concurrency control via `SELECT FOR UPDATE` on plan modifications
- Hard quotas (resource + token caps) exposed in `GET /api/v1/metrics/quotas`.
- Frontend upgrade modal and quota summary surfaces.
- Polar integration: customer_id reuse, portal return_url, 10s timeout, server config

## Configuration
- `POLAR_API_KEY`: Polar API key for checkout/customer operations
- `POLAR_WEBHOOK_SECRET`: Webhook signature validation
- `POLAR_SERVER`: `sandbox` | `production`
- `BILLING_MODE`: Currently `provider` (Polar)
- `PAYMENT_PROVIDER`: `polar`

## Locked Pricing Policy (V1)
- Trial (`trial_7d`)
  - `max_board_groups=1`
  - `max_boards=1`
  - `max_agents_total=3`
  - `max_agents_per_board=3`
  - `agent_daily_tokens=5000000`
  - `trial_total_tokens=20000000`
  - `max_tokens_per_run=8000`
  - `agent_daily_cost=2.50`
- Pro (`pro`)
  - `max_board_groups=2`
  - `max_boards=3`
  - `max_agents_total=15`
  - `max_agents_per_board=5`
  - `agent_daily_tokens=20000000`
  - `org_monthly_tokens=200000000`
  - `max_tokens_per_run=16000`
  - `agent_daily_cost=5.00`

## Out Of Scope (v1)
- Real provider checkout pages (coming in v2 with Stripe/Paddle integration).
- Billing customer/subscription/invoice domains (coming in v2).
- Tax, proration, refunds, add-ons (coming in v2).
- Webhook settlement and reconciliation (coming in v2).

## Migration Path
- Keep API contracts stable while internals switch from simulated mode to provider mode.

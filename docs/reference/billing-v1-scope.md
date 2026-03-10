# Billing V1 Scope

## Goals
- Ship a SaaS subscription model with trial and paid tiers, with deterministic quota enforcement.
- Use simulated billing in v1 to validate user flows and quota mechanics before integrating real payment providers in v2.

## In Scope
- Plans: `trial_7d`, `pro`.
- Trial default on org creation (`7 days`), then runtime is blocked when expired.
- Simulated checkout API:
  - `POST /api/v1/billing/simulate/checkout`
  - `GET /api/v1/billing/me/subscription`
- Hard quotas (resource + token caps) exposed in `GET /api/v1/metrics/quotas`.
- Frontend upgrade modal and quota summary surfaces.

## Feature Flags
- `BILLING_MODE=simulated|provider`
- `PAYMENT_PROVIDER=none|stripe|paddle`

## Locked Pricing Policy (V1)
- Trial (`trial_7d`)
  - `max_board_groups=1`
  - `max_boards=1`
  - `max_agents_total=3`
  - `max_agents_per_board=3`
  - `org_daily_tokens=40000`
  - `agent_daily_tokens=15000`
  - `trial_total_tokens=280000`
  - `max_tokens_per_run=4000`
- Pro (`pro`)
  - `max_board_groups=1`
  - `max_boards=3`
  - `max_agents_total=15`
  - `max_agents_per_board=5`
  - `org_daily_tokens=300000`
  - `agent_daily_tokens=35000`
  - `org_monthly_tokens=8000000`
  - `max_tokens_per_run=8000`

## Out Of Scope (v1)
- Real provider checkout pages (coming in v2 with Stripe/Paddle integration).
- Billing customer/subscription/invoice domains (coming in v2).
- Tax, proration, refunds, add-ons (coming in v2).
- Webhook settlement and reconciliation (coming in v2).

## Migration Path
- Keep API contracts stable while internals switch from simulated mode to provider mode.

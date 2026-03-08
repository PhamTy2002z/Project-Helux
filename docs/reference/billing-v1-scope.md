# Billing V1 Scope (Simulated Unlock)

## Goals
- Ship a SaaS-ready upgrade flow quickly with deterministic quota enforcement.
- Keep payment complexity out of v1 so rollout risk stays low.

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

## Out Of Scope
- Real provider checkout pages.
- Billing customer/subscription/invoice domains.
- Tax, proration, refunds, add-ons.
- Webhook settlement and reconciliation.

## Migration Path
- Keep API contracts stable while internals switch from simulated mode to provider mode.

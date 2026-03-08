# Phase 08: Real payment provider integration (deferred)

## Context links
- `phase-02-backend-payment-scaffold-simulated.md`
- `phase-03-entitlements-and-quota-automation-bridge.md`
- `docs/reference/api.md`

## Overview
- Priority: P1
- Status: Pending
- Description: phase future. thay simulated unlock bằng provider thật
  (Stripe/Paddle) khi hạ tầng và product signals đã đủ.

## Key insights
- Hiện tại chưa cần checkout/invoice/tax thật để validate product loop.
- Cần giữ contract API/UI ổn định từ v1 để cutover nhẹ nhàng.

## Requirements
- Functional requirements:
  - Provider adapter implement checkout/subscription/webhook flows.
  - Webhook signature verify + idempotent consume.
  - Billing portal + dunning/cancel/proration flows.
- Non-functional requirements:
  - Graceful fallback khi provider outage.
  - Retry/reconcile jobs theo schedule.

## Architecture
- Keep stable internal interface:
  - `create_checkout_session`
  - `cancel_subscription`
  - `fetch_subscription`
  - `consume_event`
- Add reconciliation cron:
  - pull provider state và tự sửa drift nội bộ.

## Related code files
- Files to modify:
  - `backend/app/services/billing/provider_interface.py`
  - `backend/app/services/billing/simulated_provider.py`
  - `backend/app/api/billing.py`
  - `backend/app/core/config.py`
- Files to create:
  - `backend/app/services/billing/stripe_provider.py` (or paddle provider)
  - `backend/app/services/billing/webhook_verifier.py`
  - `backend/tests/integration/test_billing_provider_webhooks.py`
- Files to delete:
  - Optional later: simulated-only code paths.

## Implementation steps
1. Chọn vendor theo ICP + tax/compliance requirement.
2. Implement provider adapter theo contract đã lock ở v1.
3. Implement webhook verification + idempotent persistence.
4. Run shadow mode + gradual tenant cutover.

## Todo list
- [ ] Webhook signature tests pass.
- [ ] Reconciliation job pass drift scenarios.
- [ ] Cutover runbook approved.

## Success criteria
- Transition sang provider thật không phá API/UI contract.
- Billing lifecycle đúng với production edge cases.

## Risk assessment
- Risk: webhook delays/out-of-order gây entitlement drift.
- Mitigation: replay-safe handlers + reconciliation job.

## Security considerations
- Strict secret management + rotation schedule.
- PII minimization cho billing metadata.

## Next steps
- Chỉ bắt đầu phase này sau khi v1 simulated đạt target conversion + stability.

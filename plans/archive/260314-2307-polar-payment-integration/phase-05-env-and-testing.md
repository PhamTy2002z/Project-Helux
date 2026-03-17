---
phase: 5
title: "Env Examples & Testing Checklist"
status: pending
effort: 0.5h
depends_on: [3, 4]
---

# Phase 5: Env Examples & Testing

## Overview

Update `.env.example` files with Polar variables. Provide manual testing checklist for integration.

## Related Code Files

**Modify:**
- `.env.example` (root)
- `backend/.env.example`

## Implementation Steps

### 1. Update backend/.env.example

Add after `PAYMENT_PROVIDER=none`:

```env
# --- Polar Payment Provider (only when PAYMENT_PROVIDER=polar) ---
# POLAR_ACCESS_TOKEN=pol_xxx
# POLAR_WEBHOOK_SECRET=whsec_xxx
# POLAR_PRODUCT_PRICE_ID_PRO=price_xxx
# POLAR_ENVIRONMENT=sandbox
# POLAR_SUCCESS_URL=http://localhost:3000/checkout/success?checkout_id={CHECKOUT_ID}
```

### 2. Update root .env.example

Add same Polar variables block after billing section.

### 3. Update frontend/.env.example

No changes needed -- frontend reads billing_mode from API response, no new env vars.

## Manual Testing Checklist

### Dev (simulated mode)

- [ ] `BILLING_MODE=simulated` -- app starts normally
- [ ] Simulate checkout still works
- [ ] No Polar env vars needed
- [ ] `POST /api/v1/billing/checkout` returns 409

### Staging (provider + sandbox)

- [ ] Set `BILLING_MODE=provider`, `PAYMENT_PROVIDER=polar`
- [ ] Set all `POLAR_*` env vars with sandbox credentials
- [ ] App starts without errors
- [ ] `POST /api/v1/billing/simulate/checkout` returns 409
- [ ] `POST /api/v1/billing/checkout` returns checkout URL
- [ ] Opening checkout URL shows Polar payment page
- [ ] Completing test payment triggers webhook
- [ ] Webhook updates org plan to pro
- [ ] `GET /api/v1/billing/me/subscription` shows `plan_tier: pro`

### Webhook testing

- [ ] Invalid signature returns 400
- [ ] Missing `organization_id` in metadata returns 200 (no crash)
- [ ] Unknown event type returns 200
- [ ] `subscription.active` -> plan flips to pro
- [ ] `subscription.revoked` -> plan blocked
- [ ] Duplicate events are idempotent (no crash)

### Frontend

- [ ] Simulated mode: upgrade modal shows "Confirm unlock" button
- [ ] Provider mode: upgrade modal shows "Proceed to checkout" button
- [ ] Provider mode: clicking button redirects to Polar page
- [ ] Error state shown on checkout failure

## Todo

- [ ] Update `backend/.env.example` with Polar vars
- [ ] Update root `.env.example` with Polar vars
- [ ] Run through dev testing checklist
- [ ] Run through staging testing checklist (if sandbox creds available)

## Success Criteria

- All .env.example files document Polar variables
- Dev mode unaffected by Polar integration
- Staging/prod mode works end-to-end with Polar sandbox

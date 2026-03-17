# Phase 01 -- Fix Pricing CTA Routing

## Context Links
- Plan: `plan.md`
- Brainstorm: `plans/reports/brainstorm-260316-1344-payment-flow-ux-rework.md`
- Pricing cards: `frontend/src/components/organisms/landing-page/pricing-cards.tsx`
- Pricing page: `frontend/src/app/(public)/pricing/page.tsx`
- Billing lib: `frontend/src/lib/billing.ts`

## Overview
- **Priority:** P0
- **Status:** done
- **Description:** "Get Pro" CTA on pricing page currently routes to `/onboarding` (same as free). Must route to Polar checkout instead, with auth gate.

## Key Insights
- Pricing cards is a client-rendered component (`pricing-cards.tsx`) with static `INDIVIDUAL_PLANS` array
- "Get Pro" `href` is currently `/onboarding` -- needs to become a dynamic action
- Unauthenticated users: redirect to `/sign-in?redirect_url=/checkout/pro`
- Authenticated users: call `POST /api/v1/billing/checkout` and redirect to Polar URL
- `createCheckout` from `billing.ts` already handles the API call + returns `checkout_url`
- Enterprise CTA currently `/onboarding` -- should be `#` or mailto (P2, just note)

## Requirements
### Functional
- "Get Started" (Basic) -> `/onboarding` (unchanged)
- "Get Pro" (Professional) -> auth gate -> Polar checkout redirect
- If unauth: redirect to `/sign-in?redirect_url=/checkout/pro`
- If auth: call checkout API -> redirect to Polar hosted checkout
- Enterprise CTA stays disabled ("Available Soon")

### Non-Functional
- No layout shift during checkout redirect
- Loading state on "Get Pro" button while checkout session is created

## Architecture

```
User clicks "Get Pro"
  |
  +--> isSignedIn?
       |
       +-- NO --> window.location = /sign-in?redirect_url=/checkout/pro
       |
       +-- YES --> POST /api/v1/billing/checkout
                    |
                    +--> redirect to checkout_url (Polar hosted)
                    |
                    +--> on error: show toast/alert
```

New intermediate route needed: `/checkout/pro` -- a thin page that:
1. Checks auth (redirect to sign-in if not)
2. Calls checkout API
3. Redirects to Polar URL
4. Shows loading spinner while processing

## Related Code Files

| File | Action |
|------|--------|
| `frontend/src/components/organisms/landing-page/pricing-cards.tsx` | MODIFY -- change Pro CTA from Link to button/action |
| `frontend/src/app/(app)/checkout/pro/page.tsx` | CREATE -- auth-gated checkout redirect page |
| `frontend/src/app/(public)/pricing/page.tsx` | MODIFY -- update Enterprise CTA text |
| `frontend/src/lib/billing.ts` | NO CHANGE -- `createCheckout` already exists |

## Implementation Steps

### 1. Create `/checkout/pro` page
Create `frontend/src/app/(app)/checkout/pro/page.tsx`:
- This lives under `(app)` route group so it requires auth automatically
- On mount: call `createCheckout({ plan_tier: "pro", idempotency_key: crypto.randomUUID() })`
- On success: `window.location.href = result.checkout_url`
- On error: show error message with "Try again" button
- Show centered loading spinner with "Preparing checkout..." text
- Keep under 80 lines

```tsx
// Pseudocode
"use client";
export default function CheckoutProPage() {
  // useEffect -> createCheckout -> redirect
  // error state -> show retry button
  // loading state -> spinner + "Preparing secure checkout..."
}
```

### 2. Update pricing-cards.tsx
- Change `INDIVIDUAL_PLANS[1].cta.href` from `/onboarding` to `/checkout/pro`
- The Link component already handles navigation
- Unauthenticated users will hit the `(app)` route group auth middleware and get redirected to sign-in automatically
- No need for custom auth check in pricing-cards -- the route group handles it

### 3. Update pricing page FAQ
- In `frontend/src/app/(public)/pricing/page.tsx`:
  - Update FAQ answer for "Is billing production-ready today?" to reflect live billing
  - Change from "simulated in v1" to "Powered by Polar with secure checkout"

## Todo List
- [ ] Create `frontend/src/app/(app)/checkout/pro/page.tsx`
- [ ] Update Pro CTA href in `pricing-cards.tsx`
- [ ] Update FAQ answer in pricing page
- [ ] Test: unauthenticated user clicking "Get Pro" -> sign-in -> checkout
- [ ] Test: authenticated user clicking "Get Pro" -> Polar redirect
- [ ] Test: error handling when checkout API fails

## Success Criteria
- "Get Pro" click leads to Polar checkout (not /onboarding)
- Unauthenticated users are redirected to sign-in first, then to checkout
- Loading state visible during checkout session creation
- Error state with retry option if API call fails

## Risk Assessment
- **Polar API down:** User sees error + retry button. Acceptable fallback.
- **Auth redirect loop:** Mitigated by using `(app)` route group which has built-in auth handling.
- **Double checkout:** Idempotency key per page mount prevents duplicate charges.

## Security Considerations
- Checkout session created server-side via authenticated API
- No payment data touches our frontend
- Idempotency key prevents duplicate charges on retry

## Next Steps
- Phase 4 (checkout success page) depends on this -- the `success_url` redirect from Polar lands on `/checkout/success`

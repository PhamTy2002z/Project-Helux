# Planner Report: Payment Flow UX Rework

**Plan:** `plans/260316-1405-payment-flow-ux-rework/plan.md`
**Date:** 2026-03-16
**Effort:** ~18h across 7 phases

## Summary

Created comprehensive 7-phase implementation plan to rework the payment/checkout flow from broken state to world-class SaaS standard. Polar is already live as payment provider; Resend already integrated for emails.

## Phase Overview

| # | Phase | Effort | Key Changes |
|---|-------|--------|-------------|
| 1 | Fix Pricing CTA Routing | 2h | New `/checkout/pro` page; update Pro CTA href in pricing-cards.tsx |
| 2 | Rework Upgrade Modal | 2h | Remove trial_7d card; Pro-only with feature comparison |
| 3 | Billing Page in Settings | 3h | Extract BillingSettingsSection; plan badge, usage meters, portal link |
| 4 | Checkout Success Page | 2h | New `/checkout/success`; celebration UI, polling for plan activation |
| 5 | Sidebar Usage Meter | 2h | New SidebarUsageMeter component; compact progress bar in sidebar footer |
| 6 | Billing Emails via Resend | 4h | 3 email types: upgrade confirmed, trial expiring, payment failed |
| 7 | Backend Polar Portal | 3h | New `GET /billing/portal-session`; store polar_customer_id in webhook |

## Execution Order

**Wave 1 (parallel):** Phase 7 + Phase 1 + Phase 2 + Phase 5 -- no dependencies
**Wave 2 (after Wave 1):** Phase 3 (needs Phase 7) + Phase 4 (needs Phase 1)
**Wave 3 (after Wave 1):** Phase 6 (needs Phase 7)

## Key Decisions

1. **No new DB models** -- existing `organization_plans` + `billing_checkout_attempts` sufficient
2. **Store `polar_customer_id` in plan_metadata** -- avoids extra Polar API lookups
3. **`/checkout/pro` under `(app)` route group** -- auth middleware handles sign-in redirect automatically
4. **Trial expiry email via scheduled RQ job** -- not event-driven (no webhook for "approaching expiry")
5. **Upgrade modal simplified to Pro-only** -- removes choice paralysis, simulated checkout path kept for dev

## Files Impacted

**New (7 files):**
- `frontend/src/app/(app)/checkout/pro/page.tsx`
- `frontend/src/app/(app)/checkout/success/page.tsx`
- `frontend/src/components/billing/billing-settings-section.tsx`
- `frontend/src/components/billing/sidebar-usage-meter.tsx`
- `backend/app/services/email/billing_email.py`
- `backend/app/services/email/billing_email_sender.py`
- `backend/app/services/email/billing_email_worker.py`
- `backend/app/services/billing_trial_expiry_check.py`

**Modified (8 files):**
- `frontend/src/components/organisms/landing-page/pricing-cards.tsx`
- `frontend/src/components/billing/upgrade-modal.tsx`
- `frontend/src/app/(app)/settings/page.tsx`
- `frontend/src/lib/billing.ts`
- `frontend/src/components/organisms/DashboardSidebar.tsx`
- `backend/app/api/billing.py`
- `backend/app/services/billing.py`
- `backend/app/schemas/billing.py`
- `backend/app/services/billing_webhook_service.py`
- `backend/app/services/email/resend_sender.py`
- `backend/app/services/email/queue.py`

## Unresolved Questions

1. **Backfill polar_customer_id:** Existing Pro orgs (if any) won't have `polar_customer_id` in metadata. Phase 7 includes fallback strategy (Polar customer lookup by email), but may need a one-time migration script.
2. **Trial expiry scheduled job registration:** RQ doesn't have built-in cron. Need to decide: OS-level cron calling management command, or `rq-scheduler` package, or manual daily trigger.
3. **Email "from" address for billing:** Currently `email_from_invites` is configured. May need a separate `email_from_billing` config or reuse the same.
4. **canvas-confetti dependency:** Phase 4 success page -- use CSS-only animation or add ~3KB npm package? Recommend CSS-only to avoid dependency.

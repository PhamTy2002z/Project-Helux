# Brainstorm: Payment Flow UX Rework

## Problem Statement

Current payment flow has critical UX issues:
1. **Case 1 (Landing → Pay):** "Get Pro" CTA on pricing page goes to /onboarding — same as free. User intent to pay is lost.
2. **Case 2 (Free → Pay):** Upgrade modal is too basic — no comparison, shows trial as upgrade option, no billing dashboard.
3. **No billing management page** — users can't view plan, usage, or manage subscription.
4. Overall flow doesn't meet industry SaaS standards (ChatGPT, Claude, Cursor, Linear).

## Research Conducted

- Payment flows of ChatGPT, Claude, Cursor, Linear analyzed
- Polar docs: checkout, customer portal, webhooks, Python SDK
- Resend docs: transactional emails for billing notifications
- See reports: `researcher-260316-1352-ai-saas-checkout-ux-research.md`, `researcher-260316-1401-polar-payment-platform.md`, `researcher-260316-1402-resend-email-api-research.md`

## Key Decisions

### Polar Customer Portal
- **Decision:** Use Polar's built-in customer portal instead of building custom billing management
- **Why:** Polar provides pre-authenticated portal links via `customer_sessions.create()`. Covers: upgrade/downgrade, cancel, invoices, payment method management. Zero custom UI needed.
- **How:** Backend endpoint generates portal session URL → frontend redirects user

### Checkout Flow
- **Decision:** Polar hosted checkout (redirect) not inline
- **Why:** Polar handles PCI compliance, payment methods, 3DS. Better conversion than custom forms.
- **How:** `polar.checkouts.create()` → redirect to Polar URL → success redirect back to app

### Billing Emails
- **Decision:** Resend + Jinja2 templates in backend
- **Why:** Simple, FastAPI-native. No React Email complexity needed.
- **Emails needed:** Welcome/upgrade confirmation, trial expiring (3 days before), payment failed

## Agreed Solution

### P0 — Fix Broken Flow
1. **Pricing page CTA routing:**
   - "Get Started" (Basic) → /onboarding (keep current)
   - "Get Pro" → /sign-in?redirect=/checkout/pro (if unauth) → Polar checkout → /checkout/success
   - Auth gate: if already signed in, go directly to Polar checkout
2. **Upgrade modal rework:**
   - Remove trial_7d option — only show Pro plan
   - Add feature comparison highlights
   - CTA → Polar checkout (provider mode)

### P1 — High Impact
3. **Billing page in Settings:**
   - Current plan badge + status
   - Usage meter (quota %, color-coded green/yellow/red)
   - Next billing date
   - "Manage subscription" → Polar customer portal link
   - Invoice history (from Polar API or local audit table)
4. **Post-checkout success page (/checkout/success):**
   - Celebration UI (confetti/animation)
   - Plan summary + what's unlocked
   - CTA: "Go to Dashboard" / "Create New Board"
5. **Usage meter in sidebar:**
   - Compact progress bar showing quota %
   - Click → billing page
6. **Billing emails via Resend:**
   - Upgrade confirmation
   - Trial expiring (3 days before deadline)
   - Payment failed notification

### P2 — Enhancement
7. Proactive upgrade nudge at 80% quota
8. Downgrade/cancel flow with warning
9. Dunning flow for failed payments (webhook → banner + email)
10. Annual/monthly toggle on pricing page
11. Enterprise → contact form (not /onboarding)
12. Feature comparison table on pricing page (sticky header, grouped sections)

## Architecture Impact

### New Frontend Routes/Components
- `/checkout/success` — Post-checkout success page
- Updated `/pricing` page — CTA routing fix + comparison table (P2)
- Updated upgrade modal — Pro-only, enhanced UI
- New billing page in Settings — plan, usage, portal link
- Sidebar usage meter component

### New Backend Endpoints
- `GET /billing/portal-session` — Generate Polar customer portal URL
- `POST /billing/webhooks/polar` — Already exists, may need updates for new events
- Email service integration (Resend)

### Updated Backend Services
- `billing.py` — Add portal session creation
- New `email_service.py` — Resend integration for billing emails
- Webhook service — Handle subscription lifecycle for email triggers

## Risk Assessment
- **Polar checkout UX** — Out of our control; test thoroughly on mobile
- **Webhook reliability** — Polar retries, but need idempotent handlers (already have)
- **Email deliverability** — Resend handles this; verify domain setup

## Success Metrics
- Pricing page → checkout conversion rate >5%
- Upgrade modal → checkout conversion rate >15%
- Time from "Get Pro" click to payment complete <60s
- Zero broken flow reports from users

## Next Steps
→ Create implementation plan with phases

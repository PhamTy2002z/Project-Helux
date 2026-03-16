# Payment Flow UX Rework — Implementation Report

**Date:** 2026-03-16
**Plan:** `plans/260316-1405-payment-flow-ux-rework/plan.md`
**Branch:** main
**Commits:** `d3f2de52`, `eb8c2d87`, `a97b9ded`
**Stats:** 38 files changed, ~4000 insertions, ~115 deletions

---

## 1. User Payment Flow (End-to-End)

### 1.1 New User → Free Trial

```
Landing page → "Get Started" (Basic) → /onboarding → 7-day trial auto-created
```

Không thay đổi. Flow cũ giữ nguyên.

### 1.2 Upgrade to Pro (từ Pricing Page)

```
Pricing page → "Get Pro" click
  │
  ├─ Chưa đăng nhập?
  │   └─ Redirect → /sign-in → auth middleware tự redirect về /checkout/pro
  │
  └─ Đã đăng nhập?
      └─ /checkout/pro (auth-gated page)
          │
          ├─ Tự động gọi POST /api/v1/billing/checkout
          │   └─ Backend tạo Polar checkout session
          │       └─ metadata: { organization_id, plan_tier, idempotency_key }
          │       └─ success_url: /checkout/success?checkout_id={CHECKOUT_ID}
          │
          ├─ Redirect → Polar hosted checkout (thanh toán bên Polar)
          │
          └─ Sau khi thanh toán xong:
              └─ Polar redirect → /checkout/success?checkout_id=xxx
                  │
                  ├─ Poll subscription mỗi 2s (tối đa 30s)
                  │   └─ Webhook subscription.active → flip org to "pro"
                  │   └─ Webhook cũng store polar_customer_id vào metadata
                  │   └─ Webhook enqueue upgrade confirmation email
                  │
                  ├─ Plan active → Hiện confetti + "Welcome to Pro!" + features list
                  │   └─ CTA: "Go to Dashboard" / "Create New Board"
                  │
                  └─ Timeout 30s → "Activation taking longer..." + Refresh button
```

### 1.3 Upgrade to Pro (từ Upgrade Modal)

```
Sidebar "Upgrade now" / Settings "Upgrade to Pro" / Quota exceeded dialog
  │
  └─ UpgradeModal mở (Pro-only layout)
      │
      ├─ Feature comparison: Board groups, Boards, Agents, Tokens, Max/run
      ├─ QuotaSummary (current usage)
      │
      └─ "Upgrade to Pro — $25/mo" click
          │
          ├─ Provider mode (BILLING_MODE=provider):
          │   └─ POST /api/v1/billing/checkout → redirect Polar checkout
          │
          └─ Simulated mode (BILLING_MODE=simulated):
              └─ POST /api/v1/billing/simulate/checkout → instant unlock
```

### 1.4 Manage Subscription (Pro users)

```
Settings page → Billing & Usage section
  │
  ├─ Plan badge: "Pro" (blue) / "Basic" (gray)
  ├─ Status: "Active" / "Trial expires in X days" / "Runtime blocked"
  ├─ Usage meters: color-coded bars per quota (green/yellow/red)
  │
  └─ "Manage subscription" button (Pro users only)
      └─ GET /api/v1/billing/portal-session
          └─ Backend: load polar_customer_id from org metadata
          └─ Create Polar customer session → customer_portal_url
          └─ Frontend: window.open(portal_url, "_blank")
              └─ Polar portal: update payment method, cancel, view invoices
```

### 1.5 Sidebar Usage Meter

```
Dashboard sidebar footer:
  │
  ├─ Trial expired banner (nếu blocked)
  ├─ Usage meter (compact bar)
  │   └─ Chọn quota có % cao nhất (trial_total_tokens hoặc org_monthly_tokens)
  │   └─ Label: "Monthly tokens 150M/200M"
  │   └─ Bar color: green (<70%) / yellow (70-90%) / red (>90%)
  │   └─ Click → navigate to /settings
  │
  └─ System status indicator
```

### 1.6 Billing Emails (via Resend)

```
Webhook events → enqueue billing email (non-blocking) → RQ worker processes

Email types:
  │
  ├─ Upgrade Confirmed (trigger: subscription.active webhook)
  │   └─ Subject: "Welcome to FlowGrid Pro!"
  │   └─ Content: congratulations + unlocked features + dashboard CTA
  │
  ├─ Payment Failed (trigger: subscription.revoked webhook)
  │   └─ Subject: "Action required: Payment issue on FlowGrid"
  │   └─ Content: payment issue + update payment method CTA → /settings
  │
  └─ Trial Expiring (trigger: future cron job, not yet implemented)
      └─ Subject: "Your FlowGrid trial expires in X days"
      └─ Content: urgency + upgrade CTA → /checkout/pro
```

---

## 2. Implementation Summary

### Phase 7: Backend Polar Portal Endpoint
- `GET /api/v1/billing/portal-session` — admin-only, creates Polar customer session
- `polar_customer_id` stored in `plan_metadata.billing` during webhook
- Dual extraction: `event_data.customer_id` or `event_data.customer.id`
- Error: 404 (no customer), 409 (wrong billing mode), 502 (Polar API fail)

### Phase 1: Pricing CTA Routing
- Pro CTA href: `/onboarding` → `/checkout/pro`
- New page: `(app)/checkout/pro/page.tsx` — auto-calls checkout API on mount
- Stable idempotency key via `useRef` (prevents duplicate on re-mount)
- Error → retry button; Loading → spinner + "Preparing secure checkout..."

### Phase 2: Upgrade Modal Rework
- Removed trial_7d card selection, Pro-only layout
- Feature comparison rows: Board groups, Boards, Agents, Monthly tokens, Max/run
- Dialog width narrowed: `sm:max-w-3xl` → `sm:max-w-lg`
- Button: "Upgrade to Pro — $25/mo"
- All 5 call sites verified compatible (no `initialTier` usage)

### Phase 5: Sidebar Usage Meter
- New `<SidebarUsageMeter>` picks highest-% quota with defined limit
- Color thresholds: green (<70%), yellow (70-90%), red (>90%)
- Compact format: `formatCompact()` → "150M/200M"
- Click navigates to `/settings`
- Reuses cached quota data (no extra API calls)

### Phase 3: Billing Settings Section
- Extracted from settings page → `<BillingSettingsSection>`
- Plan badge (Pro blue / Basic gray) + trial countdown
- All quotas as individual progress bars
- "Manage subscription" → Polar portal (Pro users)
- "Upgrade to Pro" button (trial users)
- Settings page simplified: 340 → 285 lines

### Phase 4: Checkout Success Page
- Route: `/checkout/success?checkout_id=xxx`
- Polls subscription every 2s (max 15 attempts = 30s)
- States: Activating → Success (confetti) → Timeout (manual refresh)
- CSS-only confetti animation (no dependencies)
- Shows unlocked features + CTA buttons

### Phase 6: Billing Emails via Resend
- 4 new files: sender interface, content builders, queue helpers, RQ worker
- 3 email types: upgrade_confirmed, trial_expiring, payment_failed
- HTML templates with `escape()` for XSS prevention
- Non-blocking: webhook handlers wrap enqueue in try/except
- Registered in `queue_worker.py` task handlers

---

## 3. Infrastructure Fix

- `compose.yml`: Added `BASE_URL: http://backend:8000` to webhook-worker env
- Worker was crash-looping due to missing required env var (pre-existing bug)

---

## 4. Code Review Fixes Applied

| ID | Issue | Fix |
|----|-------|-----|
| H1 | `customer_id` leaked in portal response | Removed from schema (least-privilege) |
| H2 | Idempotency key recreated on re-mount | `useRef(createIdempotencyKey())` |
| H3 | Unstable `subscriptionQuery` in useEffect deps | Extracted `refetch` function |
| M1+M2 | Duplicate `formatCompact` + `RESOURCE_LABELS` | Shared `billing-display-helpers.ts` |
| Test | Button text mismatch | `"Confirm unlock"` → `/Upgrade to Pro/` |

---

## 5. Docs Verified Against

| Source | Verified |
|--------|----------|
| Polar Python SDK (context7) | `customer_sessions.create` returns `customer_portal_url` ✓ |
| Polar API Reference | `checkouts.create` with `{CHECKOUT_ID}` placeholder ✓ |
| Resend Python SDK (context7) | `Emails.send(params, options)` with `idempotency_key` ✓ |

---

## 6. Files Changed

### Backend (11 files)
| File | Action |
|------|--------|
| `app/api/billing.py` | +18 lines (portal-session endpoint) |
| `app/services/billing.py` | +40 lines (create_portal_session) |
| `app/schemas/billing.py` | +4 lines (BillingPortalSessionResponse) |
| `app/services/billing_webhook_service.py` | +22 lines (customer_id + email hooks) |
| `app/services/email/billing_email_sender.py` | NEW (44 lines) |
| `app/services/email/billing_email.py` | NEW (131 lines) |
| `app/services/email/billing_email_queue.py` | NEW (91 lines) |
| `app/services/email/billing_email_worker.py` | NEW (126 lines) |
| `app/services/email/resend_sender.py` | +34 lines (ResendBillingEmailSender) |
| `app/services/email/__init__.py` | +14 lines (billing exports) |
| `app/services/queue_worker.py` | +10 lines (billing handler registration) |

### Frontend (8 files)
| File | Action |
|------|--------|
| `components/organisms/landing-page/pricing-cards.tsx` | 1-line change |
| `app/(app)/checkout/pro/page.tsx` | NEW (51 lines) |
| `app/(app)/checkout/success/page.tsx` | NEW (146 lines) |
| `components/billing/upgrade-modal.tsx` | Rewritten (156 lines) |
| `components/billing/upgrade-modal.test.tsx` | 1-line fix |
| `components/billing/sidebar-usage-meter.tsx` | NEW (71 lines) |
| `components/billing/billing-settings-section.tsx` | NEW (148 lines) |
| `components/billing/billing-display-helpers.ts` | NEW (27 lines) |

### Modified existing (2 files)
| File | Change |
|------|--------|
| `components/organisms/DashboardSidebar.tsx` | +2 lines (meter import + render) |
| `app/(app)/settings/page.tsx` | -55 lines (extracted billing section) |

### Infrastructure (1 file)
| File | Change |
|------|--------|
| `compose.yml` | +1 line (BASE_URL for webhook-worker) |

---

## 7. Compilation Status

- TypeScript: **0 errors**
- Python: **0 errors** (all `py_compile` pass)
- Docker: backend healthy, webhook-worker healthy

---

## 8. Unresolved / Future Work

- **Trial expiry cron:** Email builder exists but no scheduler yet (P2)
- **Proactive upgrade nudge** at 80% quota (P2)
- **Downgrade/cancel flow** with warning modal (P2)
- **Dunning flow** for failed payments — webhook → banner + email (P2)
- **Annual/monthly toggle** on pricing page (P2)
- **Enterprise CTA** → contact form (P2)

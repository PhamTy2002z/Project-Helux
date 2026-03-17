---
title: "Payment Flow UX Rework"
description: "Rework checkout, billing, and upgrade flows to match world-class SaaS standards using Polar + Resend"
status: in_progress
priority: P1
effort: 18h
branch: main
tags: [billing, ux, polar, resend, checkout]
created: 2026-03-16
---

# Payment Flow UX Rework

## Context
- Brainstorm: `plans/reports/brainstorm-260316-1344-payment-flow-ux-rework.md`
- Research: `plans/reports/researcher-260316-1352-ai-saas-checkout-ux-research.md`
- Polar docs: `plans/reports/researcher-260316-1401-polar-payment-platform.md`
- Resend docs: `plans/reports/researcher-260316-1402-resend-email-api-research.md`

## Phase Table

| # | Phase | Priority | Effort | Status | Depends On |
|---|-------|----------|--------|--------|------------|
| 1 | Fix Pricing CTA Routing | P0 | 2h | done | - |
| 2 | Rework Upgrade Modal | P0 | 2h | done | - |
| 3 | Billing Page in Settings | P1 | 3h | done | 7 |
| 4 | Checkout Success Page | P1 | 2h | done | 1 |
| 5 | Sidebar Usage Meter | P1 | 2h | done | - |
| 6 | Billing Emails via Resend | P1 | 4h | done | 7 |
| 7 | Backend: Polar Portal Endpoint | P1 | 3h | done | - |

## Execution Order
1. Phase 7 (backend portal endpoint) + Phase 1 + Phase 2 + Phase 5 (parallel, no deps)
2. Phase 3 + Phase 4 (depend on Phase 7 / Phase 1)
3. Phase 6 (depends on Phase 7, can start after)

## Key Architecture Decisions
- **Polar customer portal** for subscription management (no custom billing UI)
- **Polar hosted checkout** (redirect, not inline) for PCI compliance
- **Resend + Jinja2** for billing emails (reuse existing email worker pattern)
- **No new DB models** -- existing `organization_plans` + `billing_checkout_attempts` sufficient

## Resolved Decisions
- **Polar customer ID backfill:** Lazy-create fallback (create via API when needed, no migration)
- **Trial expiry scheduler:** RQ cron job (daily check, integrates with existing worker)
- **Confetti animation:** CSS-only (no extra dependency)
- **Billing email from:** Reuse existing EMAIL_FROM config (noreply@flowgrid.app)

## P2 -- Future Work (document only, no phase files)
- Proactive upgrade nudge at 80% quota
- Downgrade/cancel flow with warning modal
- Dunning flow for failed payments (webhook -> banner + email)
- Annual/monthly toggle on pricing page
- Enterprise -> contact form (not /onboarding)
- Feature comparison table on pricing page

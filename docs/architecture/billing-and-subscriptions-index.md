# Billing & Subscriptions Documentation

Quick links to billing-related documentation.

## Core Architecture

- [Billing & Polar Integration](./billing-polar-integration.md) - Webhook architecture, store-then-process pattern, concurrency controls

## Scope & Planning

- [Billing V1 Scope](../reference/billing-v1-scope.md) - In-scope features, plans, configuration

## Operational Guides

- [Incident Playbook](../operations/billing-simulated-incident-playbook.md) - Investigation steps, decision matrices, escalation

## Implementation Details

### Code Standards

See `docs/code-standards.md` → "Service Integration Patterns" → "Polar Billing Integration" for:
- Webhook pattern details
- Event handlers specification
- Plan expiry check logic
- Polar client config
- Email notification flow

### System Architecture

See `docs/system-architecture.md` → "Billing V1 & Token Quota Runtime Flow" for:
- Checkout & subscription lifecycle diagram
- Webhook event flow
- Database schema overview
- Runtime write enforcement

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Store-Then-Process** | Webhook stored before processing for audit trail + replay |
| **Plan Expiry** | `effective_until` set on all tiers when expired (pro + trial blocked) |
| **Idempotency** | Webhook event_id + billing history keyed by polar_subscription_id |
| **Concurrency** | SELECT FOR UPDATE on organization_plans for safe concurrent updates |
| **Polar Server** | Configurable via POLAR_SERVER env (sandbox/production) |

## Quick Reference

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/billing/checkout` | Initiate Polar checkout (returns session) |
| `GET /api/v1/billing/me/subscription` | Get current plan state |
| `GET /api/v1/billing/portal-session` | Get Polar customer portal link |
| `POST /webhooks/polar` | Polar webhook receiver |

### Database Tables

| Table | Purpose |
|-------|---------|
| `polar_webhook_events` | Audit log of Polar events |
| `organization_plans` | Plan state with Polar metadata |
| `billing_checkout_attempts` | Billing history (idempotent records) |

### Metrics

| Metric | Meaning |
|--------|---------|
| `saas.plan.expired.blocked` | Plan expired, user blocked (all tiers) |
| `saas.billing.webhook_received` | Polar webhook stored |
| `saas.billing.checkout_initiated` | User initiated checkout |
| `saas.billing.upgrade_confirmed` | Upgrade email sent |

---

See also: `docs/project-roadmap.md` for Phase 3 billing completion status.

# Production notes

This page defines minimum production posture for FlowGrid SaaS beta.
Apply these controls before onboarding external tenants.

## Runtime requirements

Production runtime must include:

- Postgres with routine logical backups
- Redis for queueing, rate limiting, and readiness dependency checks
- Webhook worker publishing heartbeat signal to Redis

## Required probes

Expose both probes through your load balancer:

- `/healthz` for liveness
- `/readyz` for dependency readiness

Do not route live traffic to instances where `/readyz` is failing.

## Operational targets

Use these beta targets:

- RPO: 24 hours
- RTO: 2 hours

## Rollout strategy

Use staged rollout only:

1. Internal tenants
2. Design partners
3. Controlled public beta batches

Reference: [SaaS beta go-live checklist](../release/saas-beta-go-live-checklist.md)

## Rollback criteria

Rollback is mandatory when:

- Tenant isolation is compromised
- Required readiness dependencies stay degraded
- Severe multi-tenant incident lacks immediate mitigation

## Runbooks

Operators must keep these runbooks current:

- [Operations guide](../operations/README.md)
- [Backup and restore drill](../operations/backup-restore-drill.md)
- [Incident triage](../operations/incident-triage.md)

# SaaS beta go-live checklist

Use this checklist to roll out Mission Control in controlled stages. Advance only
when current-stage exit criteria pass.

## Stage 0: Internal tenants only

Entry criteria:
- [ ] All CI gates pass, including `backend-saas-gates`
- [ ] Latest restore drill passed
- [ ] On-call and rollback owners are assigned

Execution:
- [ ] Deploy to production environment with internal tenant allowlist only
- [ ] Monitor `/readyz` and tenant SLO metrics for 24 hours

Exit criteria:
- [ ] No unresolved P1 or P2 incidents
- [ ] No cross-tenant access violations
- [ ] No sustained readiness failures

## Stage 1: Design partner cohort

Entry criteria:
- [ ] Stage 0 exit criteria complete
- [ ] Support runbooks updated with known issues and mitigations

Execution:
- [ ] Add approved design partner organizations
- [ ] Monitor `admin.*` audit events and quota pressure daily

Exit criteria:
- [ ] No critical security or isolation incidents for 7 days
- [ ] Support response remains within operating targets

## Stage 2: Controlled public beta expansion

Entry criteria:
- [ ] Stage 1 exit criteria complete
- [ ] Rollback drill and token-rotation drill verified

Execution:
- [ ] Expand tenant cohort in bounded batches
- [ ] Track error rate, cycle-time latency, and approval queue lag by tenant

Exit criteria:
- [ ] Beta SLOs remain within target for 14 days
- [ ] Incident trend is stable or improving

## No-go triggers

Stop rollout and execute rollback if any of these occur:

- Cross-tenant authz or data leak
- Unrecoverable readiness failures on required dependencies
- Restore drill failure during active rollout window
- Sustained severe incident affecting multiple tenants

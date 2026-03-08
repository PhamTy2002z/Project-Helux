# Release checklist

Use this checklist to release Mission Control with SaaS hardening gates enabled.
This checklist is for beta releases that prioritize tenant isolation, reliability,
and safe rollback.

## Before release

Complete these checks before deploying a candidate:

- [ ] Confirm release commit SHA and build artifacts
- [ ] Confirm CI is green, including `backend-saas-gates`
- [ ] Confirm latest restore drill evidence is available
- [ ] Confirm rollback owner and incident channel are assigned

## SaaS hardening gates

A release is blocked if any gate fails.

- [ ] Security gates pass
  - [ ] Auth profile strictness tests
  - [ ] Authz regression tests
- [ ] Isolation gates pass
  - [ ] Tenant invariant tests
- [ ] Reliability gates pass
  - [ ] `/readyz` dependency checks
  - [ ] Backup/restore drill validation
- [ ] Anti-abuse gates pass
  - [ ] Rate-limit tests
  - [ ] Quota enforcement tests

Run targeted gates locally:

```bash
make backend-saas-gates
```

## Deploy (Docker Compose)

```bash
docker compose -f compose.yml --env-file .env up -d --build
```

## Post-deploy verification

- [ ] `GET /healthz` returns HTTP `200`
- [ ] `GET /readyz` returns HTTP `200`
- [ ] `GET /api/v1/metrics/tenant-slo` returns tenant SLO payload
- [ ] Admin mutation endpoints emit `admin.*` audit events

## Rollback criteria

Trigger rollback immediately when any criterion is true:

- Cross-tenant authorization or data isolation regression
- Sustained `/readyz` failure for required dependencies
- High-error incident affecting beta cohort with no immediate mitigation

## Rollback actions

1. Roll back to last known-good image and restart services.
2. If schema or data corruption is suspected, run restore from latest validated
   backup.
3. Rotate tokens if compromise is suspected.
4. Re-run SaaS hardening gates before resuming rollout.

## Go-live checklist

Use the staged rollout checklist for internal, partner, and wider beta phases:

- [SaaS beta go-live checklist](./saas-beta-go-live-checklist.md)

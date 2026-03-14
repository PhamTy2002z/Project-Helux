# Phase 5: Readiness, Reliability, Backup and Restore

## Context Links

- Plan overview: [plan.md](./plan.md)
- App entrypoint health endpoints: `backend/app/main.py`
- Ops docs: `docs/operations/README.md`
- Deployment docs: `docs/deployment/README.md`, `docs/deployment-guide.md`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 4d

Upgrade runtime reliability baseline to support SaaS beta operations.

## Key Insights

- `/readyz` currently does not verify dependencies.
- Backup guidance exists but mostly manual and not drill-driven.
- Compose defaults are dev-friendly; production behavior needs explicit runbooks.

## Requirements

Functional:
- Implement real readiness checks: DB connection, Redis ping, optional worker liveness signal.
- Add automated backup job recipe with retention policy.
- Add reproducible restore drill runbook and validation checklist.

Non-functional:
- Readiness should be low-overhead and timeout-bounded.
- Backups must be encrypted at rest in production guidance.

## Architecture

Readiness endpoint behavior:
- `ok=true` only if all required dependencies healthy within timeout.
- Include structured component status payload.

Backup strategy:
- Logical backup schedule + retention window.
- Restore drill cadence (weekly in staging, monthly in production).

## Related Code Files

Modify:
- `backend/app/main.py`
- `backend/app/db/session.py`
- `docs/operations/README.md`
- `docs/production/README.md`

Create:
- `scripts/ops/backup.sh`
- `scripts/ops/restore-check.sh`
- `docs/operations/backup-restore-drill.md`

Add tests:
- `backend/tests/api/test_readiness.py`

## Implementation Steps

1. Define health component check interfaces and timeouts.
2. Implement real readiness endpoint payload.
3. Add backup automation script template and retention policy.
4. Add restore drill scripts and step-by-step docs.
5. Add CI or scheduled check for script validity.

## Todo List

- [x] Replace static readiness with dependency-aware checks.
- [x] Add backup automation assets.
- [x] Add restore drill runbook.
- [x] Define RPO/RTO targets for beta.
- [x] Validate docs via dry-run in staging.

## Success Criteria

- Readiness failures reflect true dependency failures.
- Backup + restore can be executed by on-call without tribal knowledge.
- Runbook is complete, tested, and versioned.

## Risk Assessment

- Risk: noisy readiness failures during transient outages.
- Mitigation: bounded retries and clear degraded-state semantics.

## Security Considerations

- Backup artifacts must avoid secret leakage in logs.
- Restore process must not bypass access controls.

## Next Steps

- Export operational metrics into Phase 6 dashboards.

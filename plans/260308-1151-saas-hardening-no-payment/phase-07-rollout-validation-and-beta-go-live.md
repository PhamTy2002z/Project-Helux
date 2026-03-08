# Phase 7: Rollout, Validation and Beta Go-Live

## Context Links

- Plan overview: [plan.md](./plan.md)
- CI workflow: `.github/workflows/ci.yml`
- Release checklist: `docs/release/README.md`
- Testing guide: `docs/testing/README.md`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 3d

Convert technical hardening work into enforceable release gates and a safe rollout strategy.

## Key Insights

- CI is strong for lint/type/test/build, but lacks tenant-isolation and SaaS-specific policy gates.
- Release checklist exists but must include new SaaS gates.
- Need explicit no-go criteria before opening public beta.

## Requirements

Functional:
- Add CI gates for authz regression, tenant isolation, readiness checks.
- Define staged rollout plan: internal -> design partners -> wider beta.
- Define rollback criteria and incident response hooks.

Non-functional:
- Keep release process operationally simple.
- Every gate maps to a measurable criterion.

## Architecture

Gate categories:
1. Security gates: authz negative tests, strict auth profile tests.
2. Isolation gates: cross-tenant data access tests.
3. Reliability gates: readiness endpoint integration test, restore drill check artifact.
4. Anti-abuse gates: rate-limit behavior and quota enforcement tests.

Rollout strategy:
- Stage 0: internal orgs only.
- Stage 1: limited beta org cohort.
- Stage 2: controlled public beta expansion.

## Related Code Files

Modify:
- `.github/workflows/ci.yml`
- `Makefile`
- `docs/release/README.md`
- `docs/production/README.md`

Create:
- `backend/tests/integration/test_saas_gates.py`
- `docs/release/saas-beta-go-live-checklist.md`

## Implementation Steps

1. Define pass/fail criteria for each gate category.
2. Add new test suites and wire into CI targets.
3. Update release docs with SaaS beta checklist and rollback criteria.
4. Run dry-run release rehearsal in staging.
5. Approve go-live after all gates pass.

## Todo List

- [x] Add SaaS-specific CI gates.
- [x] Publish go-live checklist.
- [x] Define staged rollout cohort process.
- [x] Validate rollback and incident response paths.
- [x] Run staging rehearsal and sign-off.

## Success Criteria

- CI blocks releases when SaaS security/isolation/reliability gates fail.
- Rollout can pause or rollback safely at each stage.
- Public beta launch is evidence-based, not checklist theater.

## Risk Assessment

- Risk: gate creep slows delivery.
- Mitigation: minimal high-signal gates first; expand gradually.

## Security Considerations

- No go-live without passing cross-tenant denial tests.
- Rollback playbook must include compromised-token response.

## Next Steps

- Execute via `/ck:cook` once plan accepted.

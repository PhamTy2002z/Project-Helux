# Phase 3: Tenant Data Isolation Foundation

## Context Links

- Plan overview: [plan.md](./plan.md)
- Tenant marker base: `backend/app/models/tenancy.py`
- Core data models: `backend/app/models/tasks.py`, `backend/app/models/activity_events.py`, `backend/app/models/agents.py`
- Org access service: `backend/app/services/organizations.py`

## Overview

- **Priority:** P1
- **Status:** Completed (2026-03-08)
- **Effort:** 7d

Establish robust tenant boundaries beyond app-layer conventions. Prepare clean path to DB-level protections.

## Key Insights

- `TenantScoped` does not enforce tenant key.
- Several high-volume tables derive tenancy indirectly via `board_id` or `agent_id`.
- DB-level RLS cannot be added safely until tenant key strategy is standardized.

## Requirements

Functional:
- Define canonical tenancy strategy per table: direct key vs derived key.
- Add `organization_id` to critical derived tables where needed for enforceability and query clarity.
- Add invariant checks to prevent cross-org references.

Non-functional:
- Migration path must preserve existing data integrity.
- Rollout should support zero/low downtime migration approach.

## Architecture

Target tenancy model tiers:
- Tier A (direct tenant key): organizations, boards, gateways, tags, skills.
- Tier B (derived today, direct tomorrow): tasks, agents, approvals, activity_events.
- Tier C (junction tables): tag_assignments, approval links, dependencies with consistency constraints.

Migration strategy:
1. Add nullable `organization_id` columns to Tier B.
2. Backfill by joining via board/gateway relations.
3. Add indexes.
4. Add not-null and FK constraints after backfill verification.
5. Update query paths to use direct org key where beneficial.

## Related Code Files

Modify:
- `backend/app/models/tasks.py`
- `backend/app/models/agents.py`
- `backend/app/models/approvals.py`
- `backend/app/models/activity_events.py`
- `backend/app/services/organizations.py`
- `backend/app/api/*` (queries updated to direct org filters where appropriate)

Add migrations:
- `backend/migrations/versions/*_add_org_id_to_core_tables.py`
- `backend/migrations/versions/*_enforce_org_id_constraints.py`

Add tests:
- `backend/tests/migrations/test_tenant_backfill.py`
- `backend/tests/services/test_tenant_invariants.py`

## Implementation Steps

1. Publish tenancy matrix doc for every model.
2. Add first migration with new org columns and indexes.
3. Backfill data in migration-safe batches.
4. Add constraints and validation checks.
5. Refactor high-risk queries to explicit org filters.
6. Add invariant tests for cross-org edge cases.

## Todo List

- [x] Approve tenancy matrix by model.
- [x] Implement additive migration + backfill.
- [x] Enforce constraints after data verification.
- [x] Update query paths to explicit org filtering.
- [x] Add invariant and regression tests.

## Success Criteria

- Critical tables carry explicit tenant identifiers.
- Cross-org joins fail by constraint/policy, not convention only.
- Query plans remain within acceptable latency after added indexes.

## Risk Assessment

- Risk: migration lock/contention in large tables.
- Mitigation: additive-first migration, staged constraint enforcement, rollback plan.

## Security Considerations

- Tenant boundary should be enforceable even if API bug exists.
- Prepare for later RLS activation once tenant keys are normalized.

## Next Steps

- Parallelize Phases 4-6 once schema baseline stabilizes.

# Phase 02: Usage Ledger Data Model And Migration

## Context Links
- [Entitlement policies](../../backend/app/services/entitlements.py)
- [Agent model](../../backend/app/models/agents.py)
- [Migration style reference](../../backend/migrations/versions/e6f7a8b9c0d1_add_org_plan_and_org_id_constraints.py)

## Overview
- Priority: P1
- Status: Pending
- Goal: persist per-agent daily billed usage with VN date boundary, idempotent delta updates.

## Key Insights
- Existing token counters in `organization_plans.metadata` are not sufficient for per-agent enforcement.
- Need row-level ledger to avoid recount when polling same session repeatedly.

## Requirements
- Functional:
  - Store per-agent per-day usage in DB.
  - Store last observed OpenClaw cumulative token total for delta math.
  - Mark blocked state/time when quota exceeded.
- Non-functional:
  - Strong uniqueness guarantees.
  - Indexed for list-agents and quota aggregation queries.

## Architecture
- Add table `agent_token_daily_usage` (one row per `agent_id + usage_date_vn`):
  - `organization_id`, `agent_id`, `usage_date_vn`
  - `openclaw_tokens_total` (latest cumulative)
  - `billed_tokens_used` (post multiplier)
  - `blocked_at` nullable
  - `last_synced_at`, `created_at`, `updated_at`
- Unique constraint: `(agent_id, usage_date_vn)`
- Secondary indexes:
  - `(organization_id, usage_date_vn)` for org daily aggregation
  - `(organization_id, agent_id, usage_date_vn)` for list query

## Related Code Files
- Modify:
  - `backend/app/models/__init__.py`
- Create:
  - `backend/app/models/agent_token_daily_usage.py`
  - `backend/migrations/versions/<new_revision>_add_agent_token_daily_usage.py`
- Delete:
  - None

## Implementation Steps
1. Create SQLModel for ledger table.
2. Add Alembic migration with constraints + indexes.
3. Register model in model export/init.
4. Add repository helpers for get-or-create and atomic increment/update.
5. Add helper for VN day derivation from UTC timestamp.

## Todo List
- [ ] Add ledger model and DB migration.
- [ ] Add atomic upsert/update helpers.
- [ ] Add VN day helper utility.
- [ ] Add model tests for uniqueness/index assumptions.

## Success Criteria
- Migration applies/rolls back cleanly.
- Ledger rows update safely under concurrent sync calls.
- Query by org/day and agent/day is indexed and fast.

## Risk Assessment
- Risk: race conditions with concurrent message dispatch.
- Mitigation: row-level lock or upsert with safe delta recompute in transaction.

## Security Considerations
- Ledger stores only numeric usage + ids, no prompt content.

## Next Steps
- Integrate sync + enforcement in phase 03.

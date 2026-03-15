# Brainstorm: Agent Token Limit Bypass — Soft-Delete Fix

## Problem Statement

Critical logic vulnerability: users bypass token quotas by deleting agents then recreating them. `AgentTokenDailyUsage.agent_id` FK has `ondelete="CASCADE"` — deleting agent cascades all usage records → quota aggregation returns 0 → unlimited tokens.

**Attack vector:** create agent → use 5M tokens → delete → create new → repeat = unlimited.

**Affected quotas:** `agent_daily_tokens`, `agent_daily_cost`, `trial_total_tokens`, `org_monthly_tokens`.

## Evaluated Approaches

### Option A: Soft-delete agent (CHOSEN)
- Add `deleted_at` column, replace `session.delete()` with timestamp set
- Usage records stay intact, quota always accurate
- **Pros:** simplest, no data loss, reversible, industry standard for billing entities
- **Cons:** need to filter deleted agents in all list/query endpoints

### Option B: Detach usage before delete
- SET `agent_id = NULL` on usage rows before hard-delete
- **Pros:** keeps hard-delete behavior
- **Cons:** orphaned records, harder to audit, breaks agent-level reporting

### Option C: Archive to summary table
- Aggregate into `org_usage_summary` before delete
- **Pros:** clean separation
- **Cons:** new table, dual-read logic, over-engineering for current scale

## Final Solution

**Soft-delete agent** with these changes:

1. Add `deleted_at: datetime | None` to `Agent` model
2. Change FK from `CASCADE` → `RESTRICT` (defense-in-depth)
3. Replace `session.delete(agent)` with `agent.deleted_at = utcnow()`
4. Filter `deleted_at IS NULL` in agent list/count queries
5. Usage aggregation queries remain unchanged (include deleted agents)
6. `max_agents_total` counts only active agents (deleted_at IS NULL) — already does via existing query

## Implementation Scope

### Files to modify:
- `backend/app/models/agents.py` — add `deleted_at` field
- `backend/app/models/agent_token_daily_usage.py` — FK CASCADE → RESTRICT
- `backend/app/services/openclaw/provisioning_db.py` — `_delete_agent_record` → soft-delete
- `backend/app/services/entitlements.py` — verify agent count queries filter deleted
- New migration for `deleted_at` column + FK change

### No rate-limit needed
Soft-delete preserves usage data → no exploit path. YAGNI.

### Trial total behavior
Deleted agents' usage counts toward trial total. Correct business logic — tokens consumed = tokens billed.

## Risk Assessment
- **Low risk:** soft-delete is well-understood pattern
- **Migration:** additive only (new nullable column + FK constraint change)
- **Rollback:** drop column, revert FK — no data loss

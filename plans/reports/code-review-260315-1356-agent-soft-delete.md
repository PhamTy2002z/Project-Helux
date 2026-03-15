# Code Review: Agent Soft-Delete & RESTRICT FK (Token Bypass Vulnerability Fix)

**Date:** 2026-03-15
**Reviewer:** code-reviewer
**Scope:** Soft-delete agents + CASCADE-to-RESTRICT FK change to close token-limit bypass

---

## Scope

- **Files reviewed:** 6 changed + 87 dependent files scouted
- **Focus:** Security fix completeness, missed `deleted_at IS NULL` filters, FK choice, edge cases
- **LOC changed:** ~120 (model, migration, service queries)

## Overall Assessment

The fix correctly addresses the vulnerability: users can no longer bypass token limits by deleting agents (CASCADE removed usage records) and recreating them (reset to 0). The implementation is solid -- soft-delete preserves billing data, RESTRICT FK prevents accidental purge, and key queries were updated. However, **several queries still miss the `deleted_at IS NULL` filter**, creating data leaks where soft-deleted agents would appear in listings, notifications, and operational flows.

---

## Critical Issues

### C1. `_find_agent_for_token` authenticates soft-deleted agents

**File:** `app/core/agent_auth.py:49-58`

The token auth lookup scans ALL agents with a non-null token hash. A soft-deleted agent's token hash is never cleared, so if the gateway session of a deleted agent is somehow still active, it could still authenticate and make API calls.

```python
# Current -- no deleted_at filter
agents = list(
    await session.exec(
        select(Agent).where(col(Agent.agent_token_hash).is_not(None)),
    ),
)
```

**Impact:** Deleted agents can still authenticate via token, bypassing the soft-delete intent. This is a security hole -- an agent that was deleted for policy reasons (e.g., rogue agent) retains API access.

**Fix:** Add `.where(col(Agent.deleted_at).is_(None))` to the query. Alternatively, clear `agent_token_hash` during soft-delete in `_delete_agent_record`.

**Recommendation:** Do both -- filter in the auth query as defense-in-depth AND clear the token hash on soft-delete. Clearing the hash is cheap and makes the intent explicit.

### C2. `resolve_board_scoped_agent` in session_usage_sync matches soft-deleted agents

**File:** `app/services/openclaw/session_usage_sync.py:54-81`

This function resolves agents by `openclaw_session_id` for quota sync. A soft-deleted agent retains its session ID and could still match, potentially causing usage sync writes to a deleted agent's ledger row.

```python
statement = (
    select(Agent)
    .where(col(Agent.openclaw_session_id) == normalized_key)
    .where(col(Agent.board_id).is_not(None))
)
# Missing: .where(col(Agent.deleted_at).is_(None))
```

**Impact:** If the gateway session outlives the DB soft-delete, usage sync could continue writing to the deleted agent's ledger. Not a security vulnerability per se, but corrupts accounting data.

**Fix:** Add `deleted_at IS NULL` filter.

---

## High Priority

### H1. Agent list in `app/api/agent.py` (agent-facing list_agents) misses `deleted_at` filter

**File:** `app/api/agent.py:558-578`

The agent-facing `GET /api/v1/agent/agents` endpoint lists agents without filtering soft-deleted ones. Board leads would see deleted agents in their agent roster.

```python
statement = select(Agent)
if agent_ctx.agent.board_id:
    statement = statement.where(Agent.board_id == agent_ctx.agent.board_id)
# Missing: statement = statement.where(col(Agent.deleted_at).is_(None))
```

**Impact:** Soft-deleted agents appear in agent-facing API responses, confusing lead agents. Leads might try to nudge or delegate to a deleted agent.

**Fix:** Add `.where(col(Agent.deleted_at).is_(None))` before the order_by clause.

### H2. `board_snapshot.py` includes soft-deleted agents in board snapshots

**File:** `app/services/board_snapshot.py:127-131`

```python
agents = (
    await Agent.objects.filter_by(board_id=board.id)
    .order_by(col(Agent.created_at).desc())
    .all(session)
)
```

This returns all agents including soft-deleted ones. Board snapshots feed the UI agent panel.

**Impact:** Deleted agents appear in the board UI, are resolved as assignees in task cards, and inflate agent counts.

**Fix:** Add `.filter(col(Agent.deleted_at).is_(None))` before `.all(session)`.

### H3. `board_lifecycle.py:delete_board` fetches all agents including soft-deleted

**File:** `app/services/board_lifecycle.py:55`

```python
agents = await Agent.objects.filter_by(board_id=board.id).all(session)
```

When deleting a board, this fetches soft-deleted agents and attempts gateway cleanup on them. Since RESTRICT FK is now active, the final `crud.delete_where(session, Agent, ...)` on line 169 will **fail with an FK violation** if any soft-deleted agent has usage ledger rows.

**Impact:** Board deletion will break (500 error) when the board contains soft-deleted agents that have token usage history. This is a **regression** caused by the RESTRICT FK change.

**Fix:** Two-part fix:
1. Filter out soft-deleted agents from the gateway cleanup loop (they are already cleaned up).
2. For the final delete, only hard-delete agents that have NO usage rows. For agents with usage, they should already be soft-deleted. If not, soft-delete them instead.

### H4. `heartbeat_lookup_statement` matches soft-deleted agents for heartbeat-or-create

**File:** `app/services/openclaw/provisioning_db.py:1479-1483`

```python
statement = Agent.objects.filter_by(name=payload.name).statement
if payload.board_id is not None:
    statement = statement.where(Agent.board_id == payload.board_id)
# Missing: .where(col(Agent.deleted_at).is_(None))
```

**Impact:** If an agent is soft-deleted and a new agent with the same name is created via heartbeat, the lookup matches the deleted agent first, preventing creation. The system would heartbeat the deleted record instead of creating a new agent.

**Fix:** Add `.where(col(Agent.deleted_at).is_(None))`.

### H5. `ensure_board_lead_agent` matches soft-deleted lead agents

**File:** `app/services/openclaw/provisioning_db.py:256-261`

```python
existing = (
    await self.session.exec(
        select(Agent)
        .where(Agent.board_id == board.id)
        .where(col(Agent.is_board_lead).is_(True)),
    )
).first()
```

If a lead agent was soft-deleted, this query still finds it and returns it as the "existing" lead. No new lead would be created, and the board would reference a deleted lead.

**Impact:** Board loses its lead agent functionality. Coordination, gateway messaging, and all lead-dependent flows break silently.

**Fix:** Add `.where(col(Agent.deleted_at).is_(None))`.

---

## Medium Priority

### M1. Multiple `Agent.objects.filter_by(board_id=...)` calls without `deleted_at` filter

The following queries return soft-deleted agents in operational contexts:

| File | Line | Context |
|------|------|---------|
| `app/api/board_memory.py` | 181 | Pause/resume command targets |
| `app/api/board_memory.py` | 269 | Chat notification targets |
| `app/api/boards.py` | 303 | Board-group agent listing |
| `app/api/boards.py` | 112 | Gateway main agent check |
| `app/api/boards.py` | 450 | Board update lead notification |
| `app/api/board_groups.py` | 224 | Board-group agent listing |
| `app/api/board_webhooks.py` | 74,78 | Webhook target agent resolution |
| `app/api/board_group_memory.py` | 317 | Board-group memory agent listing |
| `app/api/tasks.py` | 805,867 | Task agent listing for board |
| `app/api/tasks.py` | 2113 | Task completion notification targets |
| `app/api/tasks.py` | 2929 | Task update agent listing |
| `app/services/board_chat_files/reporting.py` | 215 | File report notification recipients |
| `app/services/webhooks/dispatch.py` | 74,78 | Webhook dispatch target resolution |
| `app/services/openclaw/admin_service.py` | 112 | Gateway main agent find |
| `app/services/openclaw/coordination_service.py` | 519 | Gateway main agent lookup |
| `app/services/openclaw/managed_gateway_bootstrap.py` | 47 | Main agent existence check |
| `app/services/openclaw/provisioning_db.py` | 410 | Template sync agent list |
| `app/services/openclaw/provisioning_db.py` | 735 | Main agent sync |
| `app/api/gateways.py` | 263 | Duplicate main agent cleanup |
| `app/services/board_group_snapshot.py` | 113 | Agent name lookup for tasks |

**Impact:** Varies from low (sending messages to deleted agents silently fails) to medium (UI showing stale data, incorrect counts).

**Recommendation:** Add a `.filter(col(Agent.deleted_at).is_(None))` to all queries that list/find agents for operational purposes. Gateway-main agents (`board_id IS NULL`) are arguably never soft-deleted in the current flow (protected from deletion), but adding the filter is cheap defense-in-depth.

### M2. `_token_usage_from_ledger` correctly does NOT filter by `deleted_at` (CONFIRMED OK)

**File:** `app/services/entitlements.py:312-383`

This query aggregates org-wide token usage from `AgentTokenDailyUsage`. It correctly does NOT join to the Agent table or filter by `deleted_at` -- usage from deleted agents MUST still count toward org totals to prevent the bypass. **This is correct behavior.**

### M3. `board_lifecycle.py:delete_board` performs hard-delete of agents -- FK conflict risk

With RESTRICT FK on `agent_token_daily_usage.agent_id`, hard-deleting agents that have usage rows will fail. The board delete flow at line 169 does:

```python
await crud.delete_where(session, Agent, col(Agent.id).in_(agent_ids))
```

**Recommendation:** Change board delete to soft-delete agents (set `deleted_at`) instead of hard-deleting them. The usage rows are preserved, and the FK constraint is satisfied. This aligns with the single-agent delete flow.

### M4. Organization delete in `app/api/users.py` also hard-deletes agents

**File:** `app/api/users.py:52`

The org delete cascade does `select(Agent.id).where(col(Agent.board_id).in_(board_ids))` then deletes usage rows and agents. Since RESTRICT is now on the FK, this delete order matters. The current code deletes usage rows first (line ~100-110 area), so it may work, but it's fragile.

**Recommendation:** Verify the deletion order explicitly deletes `agent_token_daily_usage` rows BEFORE agent rows. Consider soft-deleting agents in org delete too for consistency.

---

## Low Priority

### L1. No index on `deleted_at` for common query patterns

The migration adds `ix_agents_deleted_at` on the `deleted_at` column alone. Most queries filter by `(board_id, deleted_at IS NULL)` or `(organization_id, deleted_at IS NULL)`. A partial index like `CREATE INDEX ... ON agents (board_id) WHERE deleted_at IS NULL` would be more efficient.

**Impact:** Negligible at current scale. Consider adding partial indexes if agent table grows past 10K rows.

### L2. `deleted_at` field not exposed in `AgentRead` schema

The API response schema doesn't include `deleted_at`. Currently OK since deleted agents shouldn't be returned, but could be useful for admin audit endpoints.

---

## Edge Cases Found by Scouting

### E1. Gateway sessions of deleted agents remain active

When an agent is soft-deleted, `_delete_agent_record` calls `delete_agent_lifecycle` on the gateway (which deletes the agent workspace). However, the gateway session itself may still be active. If the gateway hasn't processed the delete yet, the agent could still:
- Send heartbeats (currently guarded: `agent.deleted_at is not None` returns 404)
- Authenticate (NOT guarded -- see C1)
- Have its usage synced (NOT guarded -- see C2)

### E2. Race condition: agent deleted during active quota sync

If `sync_and_enforce` is running when `_delete_agent_record` soft-deletes the agent, the sync service could hold a stale reference. The sync itself won't fail (it operates on the existing row), but the ledger write after soft-delete is wasted work. Low impact.

### E3. Re-creating agent with same name after soft-delete

`ensure_unique_agent_name` (line 1158-1195) correctly filters `deleted_at IS NULL`, so creating a new agent with the same name as a soft-deleted one works. Good.

### E4. Soft-deleted agent's tasks remain assigned

`_delete_agent_record` correctly unassigns tasks (lines 2043-2062) before soft-deleting. Good.

---

## RESTRICT vs SET NULL Analysis

**RESTRICT is the correct choice.** Rationale:

1. **SET NULL** would orphan usage rows (agent_id becomes NULL), making it impossible to:
   - Audit per-agent usage history
   - Correlate usage with the original agent
   - Debug billing disputes

2. **RESTRICT** combined with soft-delete means:
   - Usage rows always have a valid agent reference
   - Agents cannot be accidentally hard-deleted when usage exists
   - Full audit trail is preserved

3. **Hard-delete** is still possible by first deleting all usage rows (explicitly), then deleting the agent. This is the correct flow for org/board teardown where all data is purged.

---

## Positive Observations

1. **Core vulnerability is fixed.** The soft-delete + RESTRICT combination cleanly closes the bypass.
2. **Key entitlement queries updated.** `_count_agents_total`, `_count_agents_for_board`, `_max_agents_on_single_board`, `_all_board_members_blocked` all correctly filter `deleted_at IS NULL`.
3. **`_token_usage_from_ledger` correctly includes all usage** including from deleted agents.
4. **get_agent, update_agent, heartbeat_agent, delete_agent** all check `agent.deleted_at is not None` for 404.
5. **`ensure_unique_agent_name`** correctly excludes soft-deleted agents from uniqueness checks.
6. **`fetch_agent_events`** (SSE stream) correctly filters `deleted_at IS NULL`.
7. **`count_non_lead_agents_for_board`** correctly filters for spawn limits.
8. **Migration** is clean, reversible, and correctly handles the FK swap.

---

## Recommended Actions (Prioritized)

### Must Fix Before Merge

1. **C1:** Add `deleted_at IS NULL` filter to `_find_agent_for_token` in `agent_auth.py`. Clear `agent_token_hash` on soft-delete.
2. **C2:** Add `deleted_at IS NULL` filter to `resolve_board_scoped_agent` in `session_usage_sync.py`.
3. **H3:** Fix `board_lifecycle.py:delete_board` to handle soft-deleted agents and RESTRICT FK.
4. **H5:** Add `deleted_at IS NULL` filter to `ensure_board_lead_agent`.
5. **H4:** Add `deleted_at IS NULL` filter to `heartbeat_lookup_statement`.
6. **H1:** Add `deleted_at IS NULL` filter to agent-facing list_agents.
7. **H2:** Add `deleted_at IS NULL` filter to `board_snapshot.py`.

### Should Fix Soon

8. **M1:** Audit and add `deleted_at IS NULL` to all operational agent queries listed above.
9. **M3:** Change board delete to soft-delete agents instead of hard-delete (or delete usage rows first).
10. **M4:** Verify org delete handles RESTRICT FK correctly.

### Nice to Have

11. **L1:** Add partial composite indexes for common `(board_id, deleted_at IS NULL)` patterns.

---

## Metrics

- **Type Coverage:** N/A (runtime Python types, pyright passing)
- **Test Coverage:** Existing tests should be supplemented with:
  - Test: soft-deleted agent cannot authenticate
  - Test: board delete with soft-deleted agent + usage rows succeeds
  - Test: heartbeat-or-create with same name as deleted agent creates new agent
  - Test: `list_agents` excludes soft-deleted agents
- **Linting Issues:** 0 (no new linting issues found)

---

## Unresolved Questions

1. Should `board_lifecycle.py:delete_board` be refactored to soft-delete agents instead of hard-delete, or should it explicitly delete usage rows first (preserving the purge semantics)?
2. Should there be a periodic cleanup job that hard-deletes agents whose `deleted_at` is older than a retention period (e.g., 90 days) after their usage rows are archived?
3. Should gateway-main agents also support soft-delete, or should they remain hard-delete only (currently protected from deletion)?

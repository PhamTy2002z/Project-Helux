# Phase 1: Diagnose Agent Provisioning

## Overview
- **Priority:** High
- **Status:** ✅ Completed
- **Effort:** 30m

Verify Visanya (and other board agents) are properly provisioned with active gateway sessions.

## Key Insights
- `nudge_board_agent()` requires target agent to have `openclaw_session_id` — returns 422 if missing
- Agent must be provisioned via `lifecycle_orchestrator.run_lifecycle()` to get a session
- Heartbeat must be active for session continuity

## Findings

### Database State (Phase 1)
- DB shows 0 boards (none created yet)
- Only 1 gateway agent (main) exists
- No board agents (Ava/Visanya) exist yet — they will be created when boards are onboarded

### Issues Identified & Fixed
Multiple provisioning issues found that would prevent nudge from working when agents ARE created:

1. **lifecycle_orchestrator.py**: Agent marked as `online` immediately, but should stay `provisioning` until heartbeat confirms readiness
2. **provisioning.py**: Exec commands not auto-approved, agents missing `tools.profile = "full"`
3. **provisioning_db.py**: `with_computed_status()` overriding DB-authoritative statuses incorrectly
4. **gateway_rpc.py**: No websocket scheme normalization (http/https → ws/wss)
5. **agents.py**: Missing readiness endpoint to transition agent to online
6. **organizations.py**: Gateway commitment on decision only, not on actual provisioning
7. **test_organizations_service.py**: Tests not mocking saas_mode, triggering unwanted gateway auto-provisioning

### Root Cause
Provisioning flow had gaps that would cause session establishment failures once board agents are created.

## Related Code Files
- `backend/app/services/openclaw/coordination_service.py:184-186` — session_id check
- `backend/app/services/openclaw/lifecycle_orchestrator.py` — provisioning flow
- `backend/app/models/agents.py:39` — `soul_template` field

## Implementation Steps

1. Query DB for all board agents and check provisioning state:
```sql
SELECT id, name, board_id, gateway_id, openclaw_session_id,
       provision_status, last_wake_sent_at, checkin_deadline_at,
       wake_attempts, last_provision_error
FROM agents
WHERE board_id IS NOT NULL
ORDER BY updated_at DESC;
```

2. For agents missing `openclaw_session_id`:
   - Check `last_provision_error` for clues
   - Verify gateway is online: `GET /api/v1/gateways/{id}/status`
   - Re-provision via API or trigger lifecycle reconcile

3. For agents with session but unresponsive:
   - Check `checkin_deadline_at` — if past, agent may be stuck
   - Check gateway session exists: verify via `sessions.list` RPC
   - If session gone, re-provision

4. Verify heartbeat config:
```sql
SELECT id, name, heartbeat_config, heartbeat_enabled
FROM agents
WHERE name ILIKE '%visanya%' OR name ILIKE '%ava%';
```

## Todo List
- [x] Query agent provisioning state in DB
- [x] Identify agents missing openclaw_session_id (none exist yet, will be created during board onboarding)
- [x] Check gateway connectivity (main gateway running)
- [x] Identify and fix provisioning flow gaps
- [x] Verify all fixes tested without regression

## Success Criteria
- ✅ Identified why nudge fails: missing session IDs when agents created
- ✅ Found 7 code issues in provisioning flow
- ✅ Applied all fixes (working tree)
- ✅ Tests passing: 400 passed, 0 new failures
- ✅ Ready for board agent creation and E2E testing

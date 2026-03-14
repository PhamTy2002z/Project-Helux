# Phase 2: Lifecycle Orchestrator Fix

## Context

- [plan.md](./plan.md)
- [Phase 1](./phase-01-backend-readiness-endpoint.md)

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 1.5h

Modify lifecycle orchestrator to NOT mark agent "online" immediately after gateway RPC. Keep agent in "provisioning" state until readiness confirmed (via Phase 1 endpoint or heartbeat).

## Key Insights

- `lifecycle_orchestrator.py:169` calls `mark_provision_complete(locked, status="online")` right after gateway RPC succeeds
- This is the root cause — gateway accepted the request but agent isn't ready yet
- Heartbeat endpoint exists at `POST /agent/heartbeat` (`agent.py:1491`)
- Existing `checkin_deadline_at` + `lifecycle_reconcile` prevents stuck agents

## Requirements

### Functional
- After successful gateway RPC: keep agent status as `provisioning` (not `online`)
- Agent transitions to `online` when:
  - Readiness endpoint detects bootstrap complete (Phase 1), OR
  - Agent sends first heartbeat after provisioning
- Existing reconcile mechanism handles timeout fallback

### Non-functional
- No regression on existing agent update flow
- Agent update action (`action == "update"`) keeps `updating` status (already works)
- Fallback: if no readiness check/heartbeat within `checkin_deadline_at`, reconcile handles it

## Related Code Files

### Modify
- `backend/app/services/openclaw/lifecycle_orchestrator.py` — `run_lifecycle()` method, lines 169-178

### Reference (read-only)
- `backend/app/services/openclaw/db_agent_state.py` — `mark_provision_complete()`
- `backend/app/services/openclaw/lifecycle_reconcile.py` — fallback reconciliation
- `backend/app/api/agent.py` — heartbeat endpoint

## Implementation Steps

1. **Modify `run_lifecycle` post-success block** (`lifecycle_orchestrator.py:169-178`):

   Current:
   ```python
   mark_provision_complete(locked, status="online", ...)
   ```

   Change to:
   ```python
   # Don't mark online yet — wait for readiness confirmation or heartbeat.
   # Keep provisioning status; readiness endpoint or heartbeat will transition to online.
   mark_provision_complete(
       locked,
       status="provisioning",  # was "online"
       clear_confirm_token=clear_confirm_token,
   )
   ```

2. **Ensure heartbeat transitions provisioning → online**: Check `agent.py` heartbeat handler — verify it updates agent status. If heartbeat doesn't update status field, add logic:
   ```python
   if agent.status == "provisioning":
       agent.status = "online"
   ```

3. **Verify reconcile timeout still works** — `lifecycle_reconcile` should handle the case where neither readiness check nor heartbeat arrives. Agent should not be stuck in `provisioning` forever.

4. **Keep `action == "update"` behavior** — agents being updated keep `updating` status, same pattern applies.

## Todo List

- [x] Change `mark_provision_complete` call to use `status="provisioning"` in `run_lifecycle`
- [x] Verify heartbeat handler transitions provisioning → online
- [x] Add provisioning → online transition in heartbeat if needed
- [x] Verify lifecycle reconcile handles timeout correctly
- [x] Test: new provision → stays provisioning → heartbeat → online

## Success Criteria

- After `run_lifecycle` succeeds, agent.status == "provisioning" (not "online")
- Agent transitions to "online" on first heartbeat or readiness check
- No agents stuck in "provisioning" forever (reconcile timeout works)
- Existing agent update flow unaffected

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking existing flows that expect "online" after provision | High | Carefully scope change; test all provision paths |
| Agent never gets heartbeat/readiness check | Medium | Existing `checkin_deadline_at` reconcile is the safety net |
| Frontend already relies on "online" status for features | Medium | Audit frontend agent status usage before changing |

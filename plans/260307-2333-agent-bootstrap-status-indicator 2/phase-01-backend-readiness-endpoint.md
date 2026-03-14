# Phase 1: Backend Readiness Endpoint

## Context

- [Brainstorm report](../reports/brainstorm-260307-2333-agent-bootstrap-status-indicator.md)
- [plan.md](./plan.md)

## Overview

- **Priority:** P1
- **Status:** Complete
- **Effort:** 2h

Create `GET /api/v1/agents/{agent_id}/readiness` endpoint that checks real agent bootstrap state via gateway `channels.status` RPC.

## Key Insights

- Gateway exposes `channels.status` RPC method (listed in `gateway_rpc.py:49`)
- `openclaw_call()` in `gateway_rpc.py` handles WS RPC calls to gateway
- Agent model has `status` field: `provisioning | online | offline | updating | deleting`
- Need to verify `channels.status` response format — may need `health` RPC as fallback

## Requirements

### Functional
- Endpoint returns `{ ready: bool, status: str, message: str }`
- When `status == "provisioning"`: call gateway `channels.status` RPC to check real state
- When gateway confirms ready: update agent.status to `"online"` in DB, return `ready: true`
- When `status == "online"`: return `ready: true` immediately (no gateway call)

### Non-functional
- Endpoint must be lightweight — called every 3s by frontend
- Auth required (same as board read access)
- Timeout: 5s max for gateway RPC call, return `ready: false` on timeout

## Architecture

```
GET /api/v1/agents/{agent_id}/readiness
  │
  ├─ agent.status == "online" → { ready: true }
  ├─ agent.status == "provisioning" or "updating"
  │   ├─ Call gateway channels.status RPC
  │   │   ├─ Agent session bootstrapped → update DB → { ready: true }
  │   │   └─ Still bootstrapping → { ready: false, message: "Setting up..." }
  │   └─ Gateway unreachable → { ready: false, message: "Connecting..." }
  └─ agent.status == "offline" → { ready: false, message: "Offline" }
```

## Related Code Files

### Modify
- `backend/app/api/agents.py` — add readiness endpoint
- `backend/app/schemas/agents.py` — add `AgentReadiness` response schema

### Reference (read-only)
- `backend/app/services/openclaw/gateway_rpc.py` — `openclaw_call()`, `GatewayConfig`
- `backend/app/services/openclaw/db_agent_state.py` — `mark_provision_complete()`
- `backend/app/models/agents.py` — Agent model, status field
- `backend/app/services/openclaw/lifecycle_orchestrator.py` — current lifecycle flow

## Implementation Steps

1. **Add response schema** in `backend/app/schemas/agents.py`:
   ```python
   class AgentReadiness(SQLModel):
       ready: bool
       status: str
       message: str | None = None
   ```

2. **Create readiness check service function** — new function in agents API or a small helper:
   - Fetch agent by ID with board access check
   - If `status == "online"` → return ready
   - If `status in ("provisioning", "updating")`:
     - Fetch gateway for agent
     - Call `openclaw_call(config, "channels.status", {"session": agent.openclaw_session_id})`
     - Parse response to determine if bootstrap complete
     - If complete: call `mark_provision_complete(agent, status="online")`, commit, return ready
     - If not: return not ready with descriptive message
   - Else: return not ready

3. **Add endpoint** in `backend/app/api/agents.py`:
   ```python
   @router.get("/{agent_id}/readiness", response_model=AgentReadiness)
   async def check_agent_readiness(agent_id: UUID, ...):
   ```

4. **Handle gateway RPC timeout** — wrap `openclaw_call` with `asyncio.wait_for(timeout=5)`

5. **Verify `channels.status` response format** — test with actual gateway to understand response shape. If doesn't expose per-agent bootstrap state, fall back to:
   - Option A: Use `health` RPC method
   - Option B: Use heartbeat-based detection (agent sends first heartbeat when ready)

## Todo List

- [x] Add `AgentReadiness` schema
- [x] Implement readiness check logic
- [x] Add `GET /agents/{agent_id}/readiness` endpoint
- [x] Handle gateway timeout gracefully
- [x] Verify `channels.status` response format with real gateway
- [x] Add fallback if `channels.status` insufficient

## Success Criteria

- Endpoint returns correct readiness state for provisioning vs online agents
- Gateway RPC timeout doesn't block (5s max)
- Agent status transitions to "online" only when truly ready

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `channels.status` doesn't expose bootstrap state | High | Fallback to heartbeat-based or `health` RPC |
| Gateway unreachable during check | Medium | Return `ready: false` with message, don't error |
| Concurrent readiness checks race condition | Low | DB lock or optimistic update on status transition |

## Security Considerations

- Endpoint requires board read access (same auth as viewing agent)
- No sensitive data exposed — only ready/status/message

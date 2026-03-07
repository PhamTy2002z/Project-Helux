# Code Review: Agent Bootstrap Status Indicator

## Scope
- Files: `backend/app/schemas/agents.py`, `backend/app/api/agents.py`, `backend/app/services/openclaw/lifecycle_orchestrator.py`, `frontend/src/app/boards/[boardId]/page.tsx`
- LOC changed: ~90
- Focus: New readiness endpoint, status transition, frontend polling

## Overall Assessment

Solid feature. The design is sound: keep agent in "provisioning" after gateway RPC, let heartbeat or readiness poll transition to "online". A few issues need attention -- one race condition, one semantic bug in the fallback logic, and a frontend polling inefficiency.

---

## Critical Issues

### 1. `_is_agent_session_ready` fallback is overly permissive (HIGH/CRITICAL)

**File:** `backend/app/api/agents.py:188-190`

The fallback block returns `True` if gateway status is "ok"/"healthy"/"ready" even when the specific agent session was NOT found in the channels list. This means any agent on a healthy gateway will be marked "online" prematurely -- even if its session hasn't been created yet.

```python
# Current (WRONG): falls through when session_id not found in channels
status_field = gateway_response.get("status")
if status_field in ("ok", "healthy", "ready"):
    return True  # <-- marks agent ready even without matching session
```

**Fix:** Remove the fallback or restrict it to when `session_id is None` (i.e., legacy agents without session tracking):

```python
# Only use fallback when we have no session_id to match against
if session_id is None:
    status_field = gateway_response.get("status")
    if status_field in ("ok", "healthy", "ready"):
        return True
return False
```

### 2. Race condition: concurrent readiness checks can double-commit

**File:** `backend/app/api/agents.py:156-159`

Two concurrent poll requests can both read `status="provisioning"`, both call `mark_provision_complete`, both `session.add()` + `session.commit()`. While not data-corrupting (both write `status="online"`), this wastes DB round-trips and can cause stale-row conflicts depending on DB isolation level.

**Fix:** Use optimistic locking or `SELECT ... FOR UPDATE`:

```python
from sqlmodel import select
stmt = select(Agent).where(Agent.id == agent_id).with_for_update()
agent = (await session.exec(stmt)).first()
if agent and agent.status == "provisioning":
    mark_provision_complete(agent, status="online")
    session.add(agent)
    await session.commit()
```

Alternatively, accept the race and add a guard:

```python
if ready and agent.status == "provisioning":
    mark_provision_complete(agent, status="online")
    ...
```

The agent is already fetched earlier without lock, so at minimum add the status guard.

---

## High Priority

### 3. Frontend polls ALL provisioning agents sequentially in a single interval tick

**File:** `frontend/src/app/boards/[boardId]/page.tsx` (polling useEffect)

The `for...of` loop awaits each agent readiness call sequentially. With 5 agents provisioning and 5s gateway timeout each, one tick could take 25s -- blocking the next 3s interval (intervals will stack up).

**Fix:** Use `Promise.allSettled` for parallel polling:

```typescript
const poll = setInterval(async () => {
  await Promise.allSettled(
    provisioningIds.map((id) =>
      customFetch(`/api/v1/agents/${id}/readiness`, {
        method: "GET",
        signal: controller.signal,
      })
    )
  );
}, 3000);
```

### 4. Polling dependency array includes full `agents` array -- causes interval reset on every SSE update

**File:** `frontend/src/app/boards/[boardId]/page.tsx` (useEffect deps: `[isAnyAgentBootstrapping, agents]`)

Every SSE agent update (heartbeat, status change) creates a new `agents` array reference, clearing and restarting the interval. This means the 3s poll never completes a full cycle during active SSE streaming.

**Fix:** Memoize provisioning IDs separately and use that as the dependency:

```typescript
const provisioningIds = useMemo(
  () => agents.filter((a) => a.status === "provisioning").map((a) => a.id),
  [agents],
);

useEffect(() => {
  if (provisioningIds.length === 0) return;
  // ... poll using provisioningIds
}, [provisioningIds]); // stable when IDs don't change
```

Note: `provisioningIds` needs a stable reference -- use `JSON.stringify` comparison or a custom hook.

### 5. Readiness response is discarded -- no local state update

**File:** Frontend polling `catch {}` swallows everything; success path also does nothing with the response.

The poll calls the readiness endpoint but never uses the response. It relies entirely on the SSE stream to update agent status. If SSE is delayed or disconnected, the user stays in "bootstrapping" indefinitely despite the backend having transitioned the agent to "online".

**Fix:** Parse the readiness response and optimistically update local agent state:

```typescript
const res = await customFetch(`/api/v1/agents/${id}/readiness`, { ... });
if (res.ready) {
  // Update local agents state or trigger refetch
}
```

---

## Medium Priority

### 6. Exception handling catches `(TimeoutError, Exception)` -- redundant

**File:** `backend/app/api/agents.py:164`

`except (TimeoutError, Exception)` is equivalent to `except Exception` since `Exception` is the parent. If the intent was to catch `asyncio.TimeoutError` separately, use two except blocks. Current code silently swallows all exceptions including programming errors.

**Fix:**

```python
except asyncio.TimeoutError:
    logger.debug("readiness_check.timeout agent_id=%s", agent_id)
    return AgentReadiness(ready=False, status=agent.status, message="Connecting to gateway...")
except OpenClawGatewayError as exc:
    logger.debug("readiness_check.gateway_error agent_id=%s error=%s", agent_id, exc)
    return AgentReadiness(ready=False, status=agent.status, message="Connecting to gateway...")
```

### 7. `agent_id` parameter type is `str` but could receive UUID path

**File:** `backend/app/api/agents.py:113`

The endpoint declares `agent_id: str`. Other endpoints in the same file also use `str`, so this is consistent, but the `Agent.objects.by_id()` call at line 136 may expect UUID. Verify `by_id` handles string input gracefully -- if not, a malformed ID could cause 500 instead of 404.

### 8. Schema `AgentReadiness` inherits from `SQLModel` but has no table

**File:** `backend/app/schemas/agents.py:299`

Other response schemas in this file also use `SQLModel`, so this is consistent with the codebase pattern. However, `SQLModel` without `table=True` is essentially Pydantic. Low risk, just noting for awareness.

---

## Low Priority

### 9. `animate-pulse` on StatusDot has no color context

The pulse animation is added but the dot color is not changed for provisioning status. Users see a pulsing dot but the color may still indicate "offline" or whatever the default is. Consider adding an amber/yellow color for provisioning state.

### 10. Chat disabled for ALL users when ANY agent is bootstrapping

`isAnyAgentBootstrapping` disables both the task comment composer and the board chat composer. If one agent is provisioning but others are online, users still cannot chat with the online agents. Consider scoping the block to only the provisioning agent's context.

---

## Security Assessment

- **Auth:** Readiness endpoint uses `ORG_ADMIN_DEP` (same as other agent endpoints) -- properly gated.
- **Input:** `agent_id` is a path parameter, no injection risk since `service.get_agent` handles lookup.
- **Data exposure:** `AgentReadiness` only exposes `ready`, `status`, `message` -- no sensitive internal state leaked.
- **Gateway RPC:** 5s timeout prevents hanging connections. `openclaw_call` already handles TLS/auth.
- No issues found.

---

## Positive Observations

- Clean separation: readiness check is a standalone endpoint, not mixed into existing flows
- Heartbeat fallback at `provisioning_db.py:1441-1442` ensures agents transition even without polling
- `mark_provision_complete` properly clears provisioning metadata (token, action, timestamps)
- Frontend cleanup (clearInterval + AbortController) prevents leaked connections on unmount

---

## Recommended Actions (Priority Order)

1. **Fix `_is_agent_session_ready` fallback** -- prevents premature "online" marking (Critical)
2. **Add status guard before DB commit** in readiness endpoint -- prevents race condition (High)
3. **Use `Promise.allSettled`** for parallel agent polling (High)
4. **Stabilize useEffect dependency** -- extract `provisioningIds` with stable ref (High)
5. **Use readiness response** to optimistically update frontend state (High)
6. **Split exception handling** into specific types (Medium)
7. **Scope chat disable** to provisioning agent context only (Low)

---

## Unresolved Questions

- Is `openclaw_session_id` always populated when an agent is in "provisioning" state? If it can be `None`, the fallback in `_is_agent_session_ready` becomes the primary path, amplifying issue #1.
- What happens if the gateway returns a completely different `channels.status` shape than expected? The current parsing is defensive but untested.
- Should the readiness endpoint be rate-limited? With 3s frontend polling per provisioning agent, a board with many agents could generate significant gateway RPC traffic.

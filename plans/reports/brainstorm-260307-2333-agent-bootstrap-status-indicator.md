# Brainstorm: Agent Bootstrap Status Indicator

## Problem Statement

After board onboarding + confirm, Mission Control marks agent "online" immediately (after gateway RPC succeeds), but OpenClaw gateway still bootstrapping internally. User /mentions agent → no response → confusion. Messages aren't lost (queued until bootstrap completes), but user has no visibility into the wait.

## Current Flow Gap

```
User confirms onboarding
  → Backend: ensure_board_lead_agent() → gateway RPC OK
  → Backend: mark_provision_complete(status="online")
  → Frontend: agent shows "online"
  → User sends message via chat
  → OpenClaw gateway: still bootstrapping (setting up files, config, session)
  → Message queued, no response yet
  → User confused: "agent is online but not responding?"
```

## Evaluated Approaches

### Option A: Frontend Polling Agent Readiness (SELECTED)

Gateway exposes `channels.status` and `health` RPC methods. Backend creates a proxy endpoint that checks actual agent readiness on the gateway side.

**Flow:**
1. After confirm onboarding, backend keeps agent status as `provisioning` (not `online`)
2. Frontend polls new `/api/v1/agents/{id}/readiness` endpoint (2-5s interval)
3. Backend calls gateway `channels.status` or `health` RPC to check real bootstrap state
4. When gateway reports agent ready → backend updates status to `online`
5. Frontend detects `online` → hide setup indicator, enable chat

**Pros:** Clear UX, uses existing gateway methods, accurate status
**Cons:** New backend endpoint, polling load (minimal at 2-5s)

### Option B: Heartbeat-Based Readiness (NOT SELECTED)

Wait for first heartbeat from agent before marking online. Accurate but requires lifecycle orchestrator changes and depends on OpenClaw heartbeat timing.

### Option C: Optimistic UI + Queue (NOT SELECTED)

Keep current flow, just add warning. Rejected because user prefers blocking chat until ready — less confusing.

## Recommended Solution

### Architecture

```
[Frontend Board Page]
  ├─ Agent status badge: "Setting up..." (animated)
  ├─ Chat area: disabled input + contextual message
  └─ Polls GET /api/v1/agents/{id}/readiness every 3s
        │
[Backend - New Endpoint]
  └─ GET /api/v1/agents/{agent_id}/readiness
        ├─ Check agent.status in DB
        ├─ If status == "provisioning" or "updating":
        │     Call gateway RPC `channels.status` for agent session
        │     Return { ready: false, phase: "bootstrapping" }
        ├─ If gateway reports ready:
        │     Update agent.status = "online" in DB
        │     Return { ready: true }
        └─ If status == "online" (already):
              Return { ready: true }
              │
[OpenClaw Gateway]
  └─ channels.status → reports actual bootstrap state per agent session
```

### UI Design (Enterprise Best Practice)

**Pattern: Contextual Setup State (inspired by Linear, Slack, Notion)**

1. **Agent Status Badge** — next to agent name in sidebar/agent list:
   - `provisioning` → pulsing dot + "Setting up..." label
   - `online` → solid green dot + "Online"

2. **Chat Composer Area** — when agent bootstrapping:
   - Input disabled (greyed out)
   - Placeholder text: "Agent is being set up and will be ready shortly..."
   - Subtle progress indicator (pulsing border or skeleton animation)
   - Small info text below: "This usually takes 1-3 minutes"

3. **Transition Animation** — when agent becomes ready:
   - Brief success flash on badge (green pulse)
   - Chat input enables with smooth transition
   - Optional toast: "[Agent Name] is ready"

### Key Implementation Details

**Backend:**
- Don't call `mark_provision_complete(status="online")` in `lifecycle_orchestrator.run_lifecycle` immediately
- Instead use intermediate status like `provisioning` until readiness confirmed
- New endpoint: `GET /api/v1/agents/{agent_id}/readiness` — calls `channels.status` gateway RPC
- Fallback: if gateway unreachable, use `checkin_deadline_at` timeout to auto-mark online (prevent stuck state)

**Frontend:**
- Poll readiness endpoint when agent.status != "online" on board page
- Stop polling once ready
- Chat composer checks agent readiness state to enable/disable input

**Gateway RPC:**
- Use existing `channels.status` method to query agent session bootstrap state
- If insufficient, `health` method as alternative

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Gateway `channels.status` doesn't expose bootstrap phase | Fallback to heartbeat-based detection; research gateway API first |
| Agent stuck in provisioning forever | Existing `checkin_deadline_at` + `lifecycle_reconcile` already handles this |
| Polling creates load | 3-5s interval, stops when ready; only active during provisioning |
| Bootstrap time varies wildly | Show elapsed time + "usually takes X" estimate |

## Success Criteria

- User sees clear "Setting up..." indicator after confirm onboarding
- Chat input disabled until agent actually ready to respond
- Smooth transition to "ready" state with visual feedback
- No messages lost (already handled by gateway queuing)
- Agent doesn't get stuck — fallback timeout exists

## Next Steps

1. Research gateway `channels.status` RPC response format — confirm it reports bootstrap state
2. Create backend readiness endpoint
3. Modify lifecycle orchestrator to not mark `online` prematurely
4. Implement frontend provisioning banner + disabled chat
5. Add polling logic with auto-stop on ready

## Unresolved Questions

- What exact data does `channels.status` gateway RPC return? Need to verify it includes bootstrap/ready state per agent session
- Is there a more granular bootstrap phase info from gateway (e.g., "installing skills", "loading config") for richer progress UI?
- Should readiness check be scoped to specific agent session or entire gateway health?

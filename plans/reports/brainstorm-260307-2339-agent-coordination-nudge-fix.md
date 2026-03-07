# Brainstorm: Agent Coordination - Lead Nudge Not Working

**Date:** 2026-03-07
**Status:** Analysis complete, ready for plan

## Problem Statement

When user asks lead agent (Ava) to nudge member agent (Visanya) to report in Mission Control chat, it fails. Ava replies with text in chat but doesn't actually trigger Visanya's session. Visanya receives a message in her separate OpenClaw chat but has no context/state ("not started, no tasks pulled yet").

## Root Cause Analysis

### Finding 1: Code is already in sync with author
All 3 coordination layers exist and match upstream 1:1:
- `gateway_rpc.py` — WebSocket RPC (`chat.send`, `sessions.patch`)
- `gateway_dispatch.py` — `send_agent_message()` = ensure_session + send_message
- `coordination_service.py` — `nudge_board_agent()`, `message_gateway_board_lead()`, `broadcast()`
- API endpoint exists: `POST /boards/{board_id}/agents/{agent_id}/nudge` with `x-llm-intent: agent_coordination`

### Finding 2: Agent discovery mechanism is key
Author's TOOLS.md template instructs agents to run OpenAPI refresh at session start:
```bash
curl -fsS "{base_url}/openapi.json" -o api/openapi.json
jq -r '...' api/openapi.json > api/agent-lead-operations.tsv
```
This generates a TSV of available operations tagged for their role. Agents discover nudge endpoint dynamically.

### Finding 3: BOARD_AGENTS.md already has coordination instructions for Main Agent
The Main Agent section (lines 31-67) has explicit curl examples for:
- `POST .../gateway/boards/<BOARD_ID>/lead/message` — message a board lead
- `POST .../gateway/leads/broadcast` — broadcast to all leads
- Memory-based reply mechanism (non-chat memory with tags)

BUT: **Lead agent section lacks explicit nudge API instructions.** Lead agents are told about `@mentions` and task comments, but not about the HTTP nudge endpoint.

### Finding 4: Visanya lacks session state
Visanya says "not started, no tasks pulled" — indicates either:
- (a) Agent not properly provisioned (no `openclaw_session_id`)
- (b) Agent hasn't run its bootstrap/session init sequence
- (c) Agent's heartbeat not functioning

## Evaluated Approaches

### Option A: Add nudge API docs to Lead agent templates
**Approach:** Add explicit curl examples for nudge endpoint in `BOARD_AGENTS.md.j2` lead section.
- **Pros:** Direct, agents know exactly how to nudge
- **Cons:** Hardcodes endpoint paths (author's TOOLS.md says "do not hardcode endpoint paths in markdown files")

### Option B: Ensure OpenAPI refresh runs on lead session start (Recommended)
**Approach:** Author's design relies on agents discovering APIs dynamically via OpenAPI refresh. Ensure:
1. Lead agent runs OpenAPI refresh at session start
2. TSV includes nudge endpoint with `x-llm-intent` and `x-when-to-use` metadata
3. Lead agent's AGENTS.md mentions using the TSV for coordination actions

- **Pros:** Follows author's pattern exactly, self-maintaining, no hardcoded paths
- **Cons:** Requires agents to correctly parse TSV and match intent

### Option C: Hybrid — OpenAPI refresh + minimal coordination hints in AGENTS.md
**Approach:** Keep dynamic discovery as primary, but add a brief section in lead's AGENTS.md explaining coordination capabilities (nudge, broadcast) without hardcoding paths. Reference the TSV.
- **Pros:** Best of both worlds — discovery-first with enough hints for the LLM
- **Cons:** Slightly more template content

## Recommended Solution: Option C (Hybrid)

### Implementation Steps

1. **Verify Visanya's provisioning state**
   - Check DB for `openclaw_session_id` on Visanya's agent record
   - Verify gateway connection is active
   - If missing, re-provision via lifecycle orchestrator

2. **Update BOARD_AGENTS.md.j2 — Lead section**
   Add a "Coordination" section after "In Scope" that explains:
   - Lead can nudge individual agents via API (reference TSV for exact endpoint)
   - Lead can read agent status via API
   - Lead should use nudge when agent is stalled/idle/unresponsive in chat

3. **Ensure OpenAPI refresh is part of lead's session init**
   - BOARD_BOOTSTRAP.md.j2 should include the OpenAPI refresh step
   - Verify the nudge endpoint has proper `x-llm-intent`, `x-when-to-use`, `x-routing-policy` metadata (already confirmed present)

4. **Verify heartbeat config for Visanya**
   - Ensure heartbeat is active so Visanya maintains session continuity
   - Check `checkin_deadline_at` and `wake_attempts` in DB

### Key Insight from Author's Architecture

The author treats agent coordination as a **platform operations problem**:
- Agents don't talk to each other directly in chat
- All coordination goes through **Mission Control API** (HTTP)
- Lead → nudge API → gateway RPC → target agent's session
- Replies go through **non-chat memory** with structured tags
- OpenAPI discovery ensures agents always know their available actions

This is fundamentally different from "chat-based coordination" where agents just @mention each other and hope the other agent sees it.

## Risks
- If Visanya's session isn't active on gateway, nudge will fail with 422
- If OpenAPI refresh fails (network), agent falls back to guessing endpoints
- Agent LLM may not correctly map intent to TSV operation

## Success Criteria
- Lead agent (Ava) can successfully nudge Visanya via API
- Visanya receives the nudge in her gateway session and responds
- Activity log shows `agent.nudge.sent` event
- Visanya's status report appears in board chat/memory

## Unresolved Questions
1. Is Visanya's gateway session actually active? Need DB check.
2. Has any agent successfully completed the OpenAPI refresh flow in production?
3. Should we add a fallback notification mechanism (e.g., board chat mention) if nudge fails?

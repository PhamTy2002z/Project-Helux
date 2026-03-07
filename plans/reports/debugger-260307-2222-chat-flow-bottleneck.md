# Diagnostic Report: Chat Message Flow Bottleneck

**Date:** 2026-03-07
**Scope:** Board chat → OpenClaw board lead agent response
**Trigger:** User sends "hello" via board chat; agent does not respond

---

## Executive Summary

The chat message flow **sends the message successfully to the gateway** but the board lead agent **never receives a delivery signal** (`deliver: false` by default). The gateway's `chat.send` RPC call with `deliver=false` queues the message without actively waking or interrupting the agent session — effectively the message sits in the session history but the agent is not triggered to process it.

Secondary issue: the board lead response path (writing back to board memory with `tags: ["chat"]`) is architecturally correct but depends on the agent being actively interrupted to react.

---

## Complete Message Flow Path

```
User types "hello" in BoardChatComposer (frontend)
    ↓
onSend(content) → handleSendChat()
    ↓
POST /api/v1/boards/{boardId}/memory
  Body: { content: "hello", tags: ["chat"], source: <username> }
    ↓
create_board_memory() [board_memory.py]
  - Saves BoardMemory row (is_chat=True)
  - Commits to DB
  - Calls _notify_chat_targets()
    ↓
_notify_chat_targets() [board_memory.py:153]
  1. dispatch.optional_gateway_config_for_board(board)
     → returns None if no gateway configured → EARLY EXIT ⛔ [Failure Point A]
  2. Extract mentions from content
  3. _chat_targets(): selects agents where is_board_lead=True (always targeted)
     + any @mentioned non-lead agents
     → if no agents found → EARLY EXIT ⛔ [Failure Point B]
  4. For each target agent:
     - if agent.openclaw_session_id is None → skip ⛔ [Failure Point C]
     - dispatch.try_send_agent_message(
         session_key=agent.openclaw_session_id,
         config=config,
         agent_name=agent.name,
         message=<formatted message>,
         # deliver NOT passed → defaults to False  ← [Bug]
       )
    ↓
try_send_agent_message() [gateway_dispatch.py:53]
  → send_agent_message()
    → ensure_session(session_key, ...)   ← creates session if missing
    → send_message(message, session_key, config, deliver=False)  ← [Critical Bug]
    ↓
gateway_rpc.send_message() [gateway_rpc.py:538]
  → openclaw_call("chat.send", {
      sessionKey: session_key,
      message: message,
      deliver: false,   ← agent NOT actively interrupted/woken
      idempotencyKey: <uuid>
    })
    ↓
WebSocket RPC to OpenClaw gateway
  → Message queued in session history
  → Agent is NOT delivered/interrupted  ← BOTTLENECK
    ↓
Agent never sees the message → No response
```

**Frontend SSE stream** (`/boards/{boardId}/memory/stream?is_chat=true`) polls for new `BoardMemory` rows and would display any agent reply correctly — this part works fine. The break is entirely on the delivery side.

---

## Failure Points

### Primary Bug — `deliver=False` in `_notify_chat_targets`

**File:** `backend/app/api/board_memory.py`, line 209
**Code:**
```python
error = await dispatch.try_send_agent_message(
    session_key=agent.openclaw_session_id,
    config=config,
    agent_name=agent.name,
    message=message,
    # deliver not passed → defaults to False
)
```

`deliver=False` means the gateway queues the message in the session history but does **not** interrupt the agent. The agent only reads it if it is already in an active processing loop. Board lead agents (OpenClaw Claude sessions) are interrupt-driven — they need `deliver=True` to be woken up.

**Contrast with correct usage:**
- `_send_control_command()` in same file (line 116): passes `deliver=True` ✓
- `nudge_board_agent()` in `coordination_service.py` (line 199): passes `deliver=True` ✓
- `ask_user_via_gateway_main()` in `coordination_service.py` (line 468): passes `deliver=True` ✓
- `_ensure_and_message_board_lead()` in `coordination_service.py` (line 557): passes `deliver=False` — intentional (non-interactive routing)
- Wakeup provisioning in `provisioning.py` (line 1293): passes `deliver_wakeup` which defaults `True` for new agents ✓

**Same bug exists in `board_group_memory.py`** at line 286 — group chat also does not deliver.

### Failure Point A — No gateway configured for board

If `board.gateway_id` is `None` or the gateway row is missing/invalid, `optional_gateway_config_for_board()` returns `None` and `_notify_chat_targets` returns immediately. The message is stored in DB but no gateway notification is sent.

**Detection:** Board must have a valid `gateway_id` pointing to a gateway with a non-empty `url`.

### Failure Point B — No board lead agent exists

`_chat_targets()` selects `is_board_lead=True` agents. If no board lead agent has been provisioned for the board, `targets` is empty and no notification is sent.

**Detection:** At least one `Agent` row with `board_id=<board_id>` and `is_board_lead=True` must exist.

### Failure Point C — Board lead agent has no session key

Even if a lead agent exists, `if not agent.openclaw_session_id: continue` skips it. This happens when provisioning failed or was never completed.

**Detection:** `Agent.openclaw_session_id` must be non-null. For board leads, the deterministic key format is `{AGENT_SESSION_PREFIX}:lead-{board_id}:main`.

### Secondary Issue — `base_url` misconfigured

The chat notification message includes:
```
Reply via board chat:
POST {settings.base_url}/api/v1/agent/boards/{board_id}/memory
```

If `BASE_URL` is not reachable by the gateway runtime (e.g., set to `localhost:8000` but gateway runs in a different container/network), the agent receives the correct instructions but cannot POST replies back. `BASE_URL` must be externally reachable from the gateway.

---

## Root Cause

**Primary:** `_notify_chat_targets()` calls `try_send_agent_message()` without `deliver=True`. The `deliver` parameter defaults to `False` in all layers of the call chain. The OpenClaw gateway's `chat.send` with `deliver=false` stores the message without interrupting the agent session — the board lead is never actively triggered to respond.

**Contributing:** Misconfigured or absent gateway/agent setup (Failure Points A-C) can prevent even a silently-queued message from arriving.

---

## Recommended Fixes

### Fix 1 — Pass `deliver=True` in `_notify_chat_targets` (Critical)

**File:** `backend/app/api/board_memory.py`

```python
# Line 209 — change from:
error = await dispatch.try_send_agent_message(
    session_key=agent.openclaw_session_id,
    config=config,
    agent_name=agent.name,
    message=message,
)

# To:
error = await dispatch.try_send_agent_message(
    session_key=agent.openclaw_session_id,
    config=config,
    agent_name=agent.name,
    message=message,
    deliver=True,   # ← Wake the agent to process the chat message
)
```

### Fix 2 — Same fix in `board_group_memory.py` (Critical)

**File:** `backend/app/api/board_group_memory.py`, line 286 — same pattern, same fix.

### Fix 3 — Ensure `BASE_URL` is reachable by gateway runtime (Configuration)

In `backend/.env`, set `BASE_URL` to a URL reachable from within the gateway's network:
- Docker: use the backend container name, e.g. `http://backend:8000`
- Remote: use the public hostname

### Fix 4 — Validate board setup preconditions (Observability)

Add a diagnostic endpoint or log warning when `_notify_chat_targets` is called but exits early due to missing gateway config, missing lead agent, or missing session key. Currently these silent exits make debugging opaque.

---

## Verification Checklist

Before testing the fix:

1. `Board.gateway_id` is set and `Gateway.url` is non-empty
2. At least one `Agent` with `board_id=<id>` and `is_board_lead=True` exists with `status=online`
3. `Agent.openclaw_session_id` is non-null (format: `oc:lead-{board_id}:main`)
4. `BASE_URL` in backend config is reachable from the gateway runtime
5. Gateway itself is online and accepting WebSocket connections

After applying Fix 1+2:
- Send "hello" via board chat
- Expect board lead agent session to receive `chat.send` with `deliver: true`
- Agent runtime should interrupt current task and process the message
- Agent reply should appear as a new `BoardMemory` row with `tags: ["chat"]`

---

## Unresolved Questions

1. Does the OpenClaw gateway's `chat.send` with `deliver=true` guarantee the agent is woken if it's idle vs. mid-task? Or does `deliver` only interrupt mid-task agents?
2. Is `deliver=false` intentional in `_ensure_and_message_board_lead()` (coordination_service line 557) for the lead-message flow? It appears intentional (non-interactive lead routing) but should be documented.
3. What is the retry behavior if the gateway WebSocket connection fails during `_notify_chat_targets`? Currently `try_send_agent_message` swallows errors silently (`if error is not None: continue`) — failed notifications are lost with no retry.
4. Are there any rate limits or throttling on the gateway's `chat.send` that could cause silent drops under load?

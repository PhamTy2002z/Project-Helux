# OpenClaw Mission Control Chat Flow Analysis

**Research Date:** 2026-03-07
**Repository:** https://github.com/abhi1693/openclaw-mission-control
**Focus:** Agent response handling, board chat dispatch, and notification patterns

---

## Executive Summary

OpenClaw Mission Control implements a **notification-driven chat architecture** where:
1. Chat messages are persisted to database first, then agents are notified asynchronously
2. **`deliver=True` is used exclusively for control commands** (`/pause`, `/resume`) to guarantee immediate delivery
3. **`deliver=False` is the default for normal chat notifications** to allow agents flexible pickup timing
4. Agent names/sources are resolved at notification time from actor context (agent, user, or system)
5. Templates provide agents with complete API integration instructions, not just chat text

This differs from a request-response model and enables **async, persistent, mention-aware communication**.

---

## Key Findings

### 1. The `deliver` Parameter Usage

**OpenClaw Implementation:**
```python
# In gateway_dispatch.py
async def send_message(
    message: str,
    *,
    session_key: str,
    config: GatewayConfig,
    deliver: bool = False,  # DEFAULT: False
) -> object:
```

**When `deliver=True`:**
- Used only for **control commands** (`/pause`, `/resume`)
- These are system-level instructions meant to be parsed verbatim by agent runtimes
- Guarantees immediate delivery even if agent is idle

**When `deliver=False` (default):**
- Used for **normal chat notifications**
- Agent picks up message when it next checks board chat
- Agents query board chat history periodically instead of requiring push

**Our Implementation:**
- Currently uses `deliver=True` for all chat notifications in `_notify_chat_targets()`
- This forces immediate agent wakeup for every chat message
- May not align with OpenClaw's async-first philosophy

---

### 2. Chat Notification Message Template

**OpenClaw Header Pattern:**
```
BOARD CHAT MENTION      (if agent is mentioned)
BOARD CHAT              (if just broadcast to leads)
BOARD: {board.name}
FROM: {actor_name}

{message_snippet}

Reply via board chat:
POST {base_url}/api/v1/agent/boards/{board_id}/memory
Body: {"content":"...","tags":["chat"]}
```

**Key Differences in Our Implementation:**
- We use `deliver=True` (forcing immediate pickup)
- We use `/api/v1/agent/boards/` endpoint (same)
- **We include additional metadata in the response instruction:**
  ```python
  'Body: {"content":"<your actual reply>","tags":["chat"],"source":"{agent.name}"}'
  ```
  - `source` field explicitly set to agent name
  - More detailed reply instructions ("put your FULL reply text")
  - This guides agents how to respond, not just WHERE

**OpenClaw's approach:**
- Minimal instruction set: just show the endpoint and body structure
- Let agents' system prompts/templates handle the formatting details
- Relies on agent templates (in `BOARD_AGENTS.md.j2`) to instruct agents on proper response format

---

### 3. Agent Source Resolution

**OpenClaw Pattern** (from `board_memory.py`):
```python
source = payload.source
if is_chat and not source:
    if actor.actor_type == "agent" and actor.agent:
        source = actor.agent.name
    elif actor.user:
        source = actor.user.preferred_name or actor.user.name or "User"
```

**Resolution Order:**
1. Check if `source` is provided in payload
2. If not and it's a chat message:
   - For agents: use `agent.name`
   - For users: use `preferred_name` > `name` > "User" fallback

**Our Implementation:**
- Identical source resolution logic
- Also uses `_actor_display_name()` in notification headers
- Explicitly passes `source` field in response instructions

**Key Insight:**
- Source is resolved and **stored** in the memory record
- When notifying agents, the header uses the resolved actor name
- Agents receive the complete context in the notification message

---

### 4. The `try_send_agent_message` Function

**OpenClaw Implementation** (from `gateway_dispatch.py`):
```python
async def try_send_agent_message(
    self,
    *,
    session_key: str,
    config: GatewayClientConfig,
    agent_name: str,
    message: str,
    deliver: bool = False,
) -> OpenClawGatewayError | None:
    try:
        await self.send_agent_message(
            session_key=session_key,
            config=config,
            agent_name=agent_name,
            message=message,
            deliver=deliver,
        )
    except OpenClawGatewayError as exc:
        return exc
    return None
```

**Function Pattern:**
- Returns `None` on success, `OpenClawGatewayError` on failure
- Wraps `send_agent_message` with error handling
- Allows callers to silently fail and continue (for fanout scenarios)

**Usage Pattern** (from `board_memory.py`):
```python
error = await dispatch.try_send_agent_message(
    session_key=agent.openclaw_session_id,
    config=config,
    agent_name=agent.name,
    message=message,
    deliver=True,  # Control commands: deliver=True
)
if error is not None:
    continue  # Silently skip failed delivery
```

**Our Implementation:**
- Identical pattern
- Uses same error handling approach in `_notify_chat_targets()`
- Silently continues if notification fails for an agent

---

### 5. Board Chat Notification Flow

**Step 1: Create Memory**
```python
memory = BoardMemory(
    board_id=board.id,
    content=payload.content,
    tags=payload.tags,
    is_chat=is_chat,
    source=source,
)
session.add(memory)
await session.commit()
```

**Step 2: Check if Chat**
```python
if is_chat:
    await _notify_chat_targets(...)
```

**Step 3: Resolve Targets**
- For control commands (`/pause`, `/resume`): all agents on board
- For chat: board leads + mentioned agents
- Exclude sender from notification list

**Step 4: Notify Each Target**
```python
for agent in targets.values():
    if not agent.openclaw_session_id:
        continue

    error = await dispatch.try_send_agent_message(
        session_key=agent.openclaw_session_id,
        config=config,
        agent_name=agent.name,
        message=message,
        deliver=True,  # We use this for control
    )
    if error is not None:
        continue
```

**Key Pattern:**
- All fanout happens in a loop
- Each agent notified independently
- Failures don't block other notifications
- No transaction rollback for delivery errors

---

### 6. Board vs Group Memory Notification Patterns

**Board Memory** (`board_memory.py`):
- Simpler targeting: board leads + mentions only
- Header: `"BOARD CHAT MENTION"` or `"BOARD CHAT"`
- Reply endpoint: `POST {base_url}/api/v1/agent/boards/{board_id}/memory`

**Group Memory** (`board_group_memory.py`):
- Complex targeting: must fetch boards in group, then agents in those boards
- Additional broadcast mode: `"GROUP BROADCAST"` (uses `@all` mention)
- Header varies: `"GROUP BROADCAST"` | `"GROUP CHAT MENTION"` | `"GROUP CHAT"`
- Reply endpoint: `POST {base_url}/api/v1/boards/{board_id}/group-memory`
- Uses `_NotifyGroupContext` dataclass to batch fetch board/agent lookups

**Group-Specific Logic:**
```python
async def _notify_group_target(context, agent):
    board = context.board_by_id.get(agent.board_id)
    if board is None:
        return
    config = await context.dispatch.optional_gateway_config_for_board(board)
    # Must fetch gateway config per board (different gateways possible)
```

**Key Difference:**
- Board chat: single board, single gateway config
- Group chat: multiple boards, multiple gateway configs per agent
- Group chat checks agent's board to find correct gateway

---

### 7. Agent Template Instructions for Chat Responses

**From `BOARD_AGENTS.md.j2`:**

For Board Leads (if applicable):
```
## User outreach requests (from board leads)
- If you receive a message starting with `LEAD REQUEST: ASK USER`, a board lead
  needs human input but cannot reach them in Mission Control.
- Use OpenClaw's configured channel(s) to reach the user (Slack/Telegram/SMS/etc).
- When you receive the user's answer, write it back to the originating board as
  a NON-chat memory item tagged like `["gateway_main","user_reply"]`.
```

For Regular Agents:
```
## Communication
- Use task comments for task progress/evidence/handoffs.
- Use board chat only for decisions/questions needing human response.
- Do not spam status chatter. Post only net-new value.
```

For Group Chat:
```
## Group Chat Rules
- Board chat uses board memory entries with tag `chat`.
- Group chat uses board-group memory entries with tag `chat`.
- Mentions are single-token handles (no spaces).
- Notification behavior: Board chat notifies board leads by default, plus mentioned agents.
- Sender is excluded from their own chat fanout.
```

**Critical Insight:**
- Templates define the **integration contract** agents follow
- They show agents exactly:
  - Which endpoints to use for responses
  - What tags to include (`["chat"]`)
  - What fields are required (`content`, `tags`)
  - When to use chat vs task comments vs memory
- This is **not** shown to the agent in the notification message itself
- It's in the agent's persistent workspace templates (read at startup)

---

### 8. Control Command Pattern

**OpenClaw's Approach:**
```python
if command in {"/pause", "/resume"}:
    await _send_control_command(...)
    return  # Skip normal chat fanout for control
```

**Characteristics:**
- Commands are prefixed with `/`
- Case-insensitive comparison
- Sent with `deliver=True` (immediate guaranteed delivery)
- Sent to **all agents on board** (not just leads/mentions)
- Skip normal chat fanout entirely
- Parsed verbatim by agent runtimes

**Our Implementation:**
- Identical: control commands use `deliver=True`
- Same fanout pattern to all agents
- Same early return to prevent double-notification

---

### 9. Comparison Table: OpenClaw vs Our Implementation

| Aspect | OpenClaw | Our Implementation | Alignment |
|--------|----------|-------------------|-----------|
| Chat persistence | Store first, notify async | Store first, notify async | ✅ Aligned |
| `deliver=True` usage | Control commands only | Control + all chat | ⚠️ Different |
| `deliver=False` usage | Normal chat notifications | Not used | ⚠️ Different |
| Source resolution | Payload > actor context | Payload > actor context | ✅ Aligned |
| Chat targets | Leads + mentions | Leads + mentions | ✅ Aligned |
| Target filtering | Exclude sender | Exclude sender | ✅ Aligned |
| Notification header | Mention-aware (3 variants) | Mention-aware (2 variants) | ✅ Mostly aligned |
| Reply instructions | Minimal (just endpoint) | Detailed (with format guidance) | ⚠️ Different philosophy |
| Error handling | Silently continue | Silently continue | ✅ Aligned |
| Board vs Group | Different targeting logic | Group not implemented yet | ⚠️ Feature gap |
| Template location | `backend/templates/*.j2` | `backend/templates/*.j2` | ✅ Same location |
| Control commands | `/pause`, `/resume` | `/pause`, `/resume` | ✅ Aligned |

---

## Architectural Insights

### 1. Notification Model: Push vs Pull

**OpenClaw's Choice:**
- Chat notifications are **push notifications** (send to agent via gateway)
- But agents are free to ignore them or check periodically
- `deliver=False` (default) means agent decides when to read
- Agent templates encourage periodic polling of board chat

**Effect:**
- Reduces pressure on gateway RPC connections
- Allows agents to batch-check multiple boards
- Supports agents with sparse availability patterns

**Our Choice:**
- Using `deliver=True` for all chat forces immediate agent pickup
- More responsive but potentially noisy
- Treats every chat message like an urgent system command

### 2. Control vs Information

**OpenClaw Distinction:**
- **Control commands** (`/pause`, `/resume`): `deliver=True` - system instructions
- **Chat messages**: `deliver=False` - information/coordination

**Philosophy:**
- Only parse `/` prefixed commands as system-level controls
- Everything else is async information that agents pull when ready

### 3. Agent Integration Points

**OpenClaw agents receive instructions from 3 sources:**

1. **Agent templates** (`BOARD_AGENTS.md.j2` etc): Integration contracts, workflows
2. **Notification messages**: Immediate contextual information
3. **Board memory endpoints**: Historical data to query on demand

**Separation of Concerns:**
- Templates: "Here's how to integrate with this system"
- Notifications: "Something just happened that affects you"
- Memory endpoints: "Here's the audit trail if you want to review"

### 4. No Transactional Guarantees on Delivery

**OpenClaw Pattern:**
- Memory is committed to DB first
- Agent notification failures do not roll back the memory
- System prefers durability (DB) over delivery guarantee

**Implication:**
- Agents might miss notifications but can always query memory history
- Reduces complexity of distributed transaction handling
- Requires agents to be resilient to notification loss

---

## Unresolved Questions

1. **How do agents decide to check board chat?** Is it:
   - Periodic polling (heartbeat-based)?
   - Triggered by notification receipt?
   - Manual request in agent code?
   - All of the above depending on agent type?

2. **Are there retry mechanisms for failed notifications?**
   - Current code silently skips failures
   - Does the gateway persist notifications for later retry?

3. **How are mentions parsed and validated?**
   - The code calls `extract_mentions()` and `matches_agent_mention()`
   - Where are these defined? Are they simple `@name` parsing or more complex?

4. **What happens if an agent provides invalid `source` in the payload?**
   - Current code trusts the payload source directly
   - Should there be validation that source matches the authenticated actor?

5. **For group memory, how is the board selection handled when an agent is in multiple boards?**
   - Code maps `board_id` from agent record
   - But agents could theoretically be in multiple boards
   - Is there a primary board concept or a many-to-one mapping?

6. **Are there any rate limits or throttling on chat fanout?**
   - The loop sends all notifications sequentially
   - Large boards might have slow fanout
   - Any async batching or timeout handling?

---

## Recommendations for Our Implementation

### Short-term Alignment

1. **Keep `deliver=True` only for control commands** (`/pause`, `/resume`)
2. **Use `deliver=False` for normal chat notifications**
   - Allows agents flexibility in message pickup timing
   - Aligns with OpenClaw's async philosophy

3. **Simplify reply instructions in notification**
   - Remove detailed formatting guidance from the notification body
   - Rely on agent templates to define integration contracts
   - Keep notification to: endpoint + body structure only

4. **Add board-group memory support** (if needed)
   - Implement `_notify_group_memory_targets()` similar to OpenClaw
   - Handle multiple boards and gateway configs per agent
   - Add broadcast mode targeting

### Long-term Considerations

1. **Agent template synchronization**
   - Consider versioning agent templates
   - Track which template version agents were initialized with
   - Handle template upgrades gracefully

2. **Notification reliability**
   - Consider persisting failed notifications for retry
   - Add metrics for notification delivery success rate
   - Implement circuit breaker for gateway connection failures

3. **Chat history query patterns**
   - Agents will query `/memory?is_chat=true` frequently
   - Consider indexing on `is_chat` + `board_id` + `created_at`
   - Monitor query performance as chat volume grows

4. **Mention resolution**
   - Current mention matching is done per notification
   - Consider pre-resolving mentions at memory creation time
   - Cache mention match results if agents are mentioned frequently

---

## Files Referenced

**OpenClaw Mission Control Repository:**
- `backend/app/api/board_memory.py` - Board chat endpoints & notification logic
- `backend/app/api/board_group_memory.py` - Group chat endpoints & notification logic
- `backend/app/services/openclaw/gateway_dispatch.py` - Message dispatch service
- `backend/app/services/openclaw/gateway_rpc.py` - Low-level gateway RPC client
- `backend/templates/BOARD_AGENTS.md.j2` - Agent integration template
- `backend/templates/BOARD_MEMORY.md.j2` - Memory guidance template

**Our Project (Project-Helux):**
- `backend/app/api/board_memory.py` - Our implementation (mostly aligned)
- `backend/app/services/openclaw/gateway_dispatch.py` - Our implementation (identical)
- `backend/app/services/openclaw/gateway_rpc.py` - Our implementation (identical)
- `backend/templates/BOARD_AGENTS.md.j2` - Our agent template

---

## Conclusion

OpenClaw Mission Control implements a **mature, async-first chat architecture** where:
- Persistence comes before notification
- Control commands are distinct from information messages
- Agent templates define the integration contract
- Notifications are informational, not mandatory

Our implementation is **largely aligned** but with different `deliver` parameter usage that makes all chat notifications synchronous. The recommended change to align with OpenClaw's philosophy would be to use `deliver=False` for chat messages and reserve `deliver=True` only for system-level control commands.

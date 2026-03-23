# Agent Board Chat Routing Architecture
## OpenClaw Mission Control - Research Report

**Repository:** https://github.com/abhi1693/openclaw-mission-control
**Research Date:** 2026-03-23
**Focus:** Board chat message routing to agents

---

## Executive Summary

OpenClaw implements a **two-layer chat routing system**:
1. **Board-level chat** - Single board, all agents on that board
2. **Group-level chat** - Cross-board coordination, all agents in linked boards

Routes messages via agent mentions (`@name`), with special handling for **lead agents** (`@lead` shortcut). Messages dispatch via **OpenClaw Gateway RPC** to agent session IDs.

---

## 1. Board Chat Routing Architecture

### Entry Point: `/api/v1/boards/{board_id}/memory` (POST)

**File:** `/backend/app/api/board_memory.py` (lines 274-306)

```python
@router.post("", response_model=BoardMemoryRead)
async def create_board_memory(
    payload: BoardMemoryCreate,
    board: Board = BOARD_WRITE_DEP,
    session: AsyncSession = SESSION_DEP,
    actor: ActorContext = ACTOR_DEP,
) -> BoardMemory:
    """Create a board memory entry and notify chat targets when needed."""
    is_chat = payload.tags is not None and "chat" in payload.tags
    # ... persist to BoardMemory model ...
    if is_chat:
        await _notify_chat_targets(  # Line 300
            session=session,
            board=board,
            memory=memory,
            actor=actor,
        )
```

**Key Detail:** Only routes when `"chat"` tag is in payload. Messages stored in `BoardMemory` table (`/backend/app/models/board_memory.py`).

---

## 2. Chat Target Resolution: The Core Routing Logic

**Function:** `_chat_targets()` (lines 127-142)

```python
def _chat_targets(
    *,
    agents: list[Agent],
    mentions: set[str],
    actor: ActorContext,
) -> dict[str, Agent]:
    targets: dict[str, Agent] = {}
    for agent in agents:
        # RULE 1: Always include board lead
        if agent.is_board_lead:
            targets[str(agent.id)] = agent
            continue
        # RULE 2: Include agents matched by mention
        if mentions and matches_agent_mention(agent, mentions):
            targets[str(agent.id)] = agent
    # RULE 3: Exclude sender if sender is an agent
    if actor.actor_type == "agent" and actor.agent:
        targets.pop(str(actor.agent.id), None)
    return targets
```

### Targeting Rules (Priority Order)

| Rule | Condition | Who Gets Notified | Note |
|------|-----------|-------------------|------|
| 1 | Agent is `is_board_lead=True` | Board lead always | Always receives messages |
| 2 | Agent mentioned in message | Mentioned agents | Via `@name` or `@lead` |
| 3 | Sender is an agent | Sender is excluded | Prevents self-messaging |

**Result:** Returns dict of `{agent_id_string: Agent}` to notify.

---

## 3. Mention Extraction & Matching

### Mention Pattern Recognition

**File:** `/backend/app/services/mentions.py`

```python
MENTION_PATTERN = re.compile(r"@([A-Za-z][\w-]{0,31})")

def extract_mentions(message: str) -> set[str]:
    """Extract normalized mention handles from a message body."""
    return {match.group(1).lower() for match in MENTION_PATTERN.finditer(message)}
```

**Rules:**
- Matches `@token` where token = 1-32 chars, starts with letter, can contain `[A-Za-z0-9_-]`
- All mentions normalized to **lowercase**
- Example: `@alex`, `@alice-bob`, `@lead` all valid; `@123` invalid

### Mention Matching Logic

**Function:** `matches_agent_mention()` (lines 20-40)

```python
def matches_agent_mention(agent: Agent, mentions: set[str]) -> bool:
    """Return whether a mention set targets the provided agent."""
    if not mentions:
        return False

    # SPECIAL CASE: "@lead" shortcut for board lead
    if "lead" in mentions and agent.is_board_lead:
        return True
    mentions = mentions - {"lead"}  # Remove @lead from further matching

    # MATCH 1: Exact name match (case-insensitive)
    name = (agent.name or "").strip()
    if not name:
        return False
    normalized = name.lower()
    if normalized in mentions:
        return True

    # MATCH 2: First name match for display names with spaces
    # e.g., "@alice" matches agent named "Alice Cooper"
    first = normalized.split()[0]
    return first in mentions
```

**Matching Strategy:**

| Scenario | Result |
|----------|--------|
| Agent name: "Alice", mention: `@alice` | ✓ MATCH (exact) |
| Agent name: "Alice Cooper", mention: `@alice` | ✓ MATCH (first name) |
| Agent name: "Alice Cooper", mention: `@cooper` | ✗ NO MATCH (last name ignored) |
| Agent is board lead, mention: `@lead` | ✓ MATCH (reserved shortcut) |
| Agent not board lead, mention: `@lead` | ✗ NO MATCH |

---

## 4. Message Notification Dispatch

**Function:** `_notify_chat_targets()` (lines 153-216)

### Control Commands (Special Case)

Lines 169-180: Handle `/pause` and `/resume` commands - broadcast to **all agents** on board:

```python
command = normalized.lower()
if command in {"/pause", "/resume"}:
    await _send_control_command(
        session=session,
        board=board,
        actor=actor,
        dispatch=dispatch,
        config=config,
        command=command,
    )
    return
```

Skips mention extraction entirely for these commands.

### Chat Message Notification

Lines 182-216: For normal messages:

```python
mentions = extract_mentions(memory.content)
targets = _chat_targets(
    agents=await Agent.objects.filter_by(board_id=board.id).all(session),
    mentions=mentions,
    actor=actor,
)

for agent in targets.values():
    if not agent.openclaw_session_id:
        continue
    mentioned = matches_agent_mention(agent, mentions)
    header = "BOARD CHAT MENTION" if mentioned else "BOARD CHAT"
    message = (
        f"{header}\n"
        f"Board: {board.name}\n"
        f"From: {actor_name}\n\n"
        f"{snippet}\n\n"
        "Reply via board chat:\n"
        f"POST {base_url}/api/v1/agent/boards/{board.id}/memory\n"
        'Body: {"content":"...","tags":["chat"]}'
    )
    error = await dispatch.try_send_agent_message(
        session_key=agent.openclaw_session_id,
        config=config,
        agent_name=agent.name,
        message=message,
    )
```

**Header Variation:**
- Mentioned agents: `"BOARD CHAT MENTION"`
- Non-mentioned but included agents (board lead): `"BOARD CHAT"`

**Message Format:**
- Includes board name, sender name, content snippet (max 800 chars)
- Provides reply instruction with API endpoint + body template
- Sent only to agents with `openclaw_session_id` (active agents)

---

## 5. Gateway Dispatch Mechanism

**Service:** `GatewayDispatchService` (lines 24-79 in `/backend/app/services/openclaw/gateway_dispatch.py`)

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

**Key Fields:**
- `session_key`: Agent's `openclaw_session_id` (required, skips if missing)
- `config`: Gateway client config from board's `gateway_id`
- `message`: Formatted notification text
- `deliver`: Boolean flag for delivery guarantee

**Dispatch Flow:**
1. Get optional gateway config for board
2. If no gateway, exit silently (agents can't be reached)
3. For each target agent, call `try_send_agent_message`
4. Silently skip on error (fail-open design)

---

## 6. Lead Agent vs Member Agents

**Model Field:** `Agent.is_board_lead` (boolean, lines 51 in `/backend/app/models/agents.py`)

### Board Lead Behavior

- **Always receives messages** - treated as implicit recipient
- Can be targeted explicitly via `@lead` shortcut
- Differentiates between "mentioned" and "not mentioned" status (affects header)
- Only one lead per board typically, but model allows multiple

### Member Agent Behavior

- Only receives messages if:
  1. Explicitly mentioned by name (`@alice`)
  2. Mentioned by first name if display name has spaces (`@alice` for "Alice Cooper")
  3. OR, if actor is themselves and excluded (RULE 3)

### Actor Context Detection

**File:** `/backend/app/api/deps.py` (lines 67-92)

```python
async def require_user_or_agent(
    request: Request,
    session: AsyncSession = SESSION_DEP,
) -> ActorContext:
    """Authorize either a human user or an authenticated agent."""
    auth = await get_auth_context_optional(request=request, ...)
    if auth is not None:
        require_user_actor(auth)
        return ActorContext(actor_type="user", user=auth.user)
    agent_auth = await get_agent_auth_context_optional(
        request=request,
        agent_token=request.headers.get("X-Agent-Token"),
        authorization=request.headers.get("Authorization"),
        session=session,
    )
    if agent_auth is not None:
        return ActorContext(actor_type="agent", agent=agent_auth.agent)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
```

**Precedence:** User auth checked first (doesn't trigger agent verification). Agent detected via:
- `X-Agent-Token` header (custom)
- `Authorization` header (standard)

---

## 7. Board Group Chat Routing (Cross-Board)

Parallel implementation for **board groups** (multiple linked boards):

**File:** `/backend/app/api/board_group_memory.py`

### Group Chat Targets Function

Lines 209-227:

```python
def _group_chat_targets(
    *,
    agents: list[Agent],
    actor: ActorContext,
    is_broadcast: bool,
    mentions: set[str],
) -> dict[str, Agent]:
    targets: dict[str, Agent] = {}
    for agent in agents:
        if not agent.openclaw_session_id:
            continue
        if actor.actor_type == "agent" and actor.agent and agent.id == actor.agent.id:
            continue
        # BROADCAST MODE: include all board leads
        if is_broadcast or agent.is_board_lead:
            targets[str(agent.id)] = agent
            continue
        # MENTION MODE: only include mentioned agents
        if mentions and matches_agent_mention(agent, mentions):
            targets[str(agent.id)] = agent
    return targets
```

### Key Differences from Board Chat

| Feature | Board Chat | Group Chat |
|---------|-----------|-----------|
| **Scope** | Single board | All boards in group |
| **Broadcast** | Control commands only | Tag-driven: `"broadcast"` or `@all` |
| **Agents** | Board agents only | All agents in linked boards |
| **Lead Behavior** | Always included | Always included (unless broadcast) |
| **Header** | `"BOARD CHAT"` / `"BOARD CHAT MENTION"` | `"GROUP CHAT"` / `"GROUP CHAT MENTION"` / `"GROUP BROADCAST"` |

### Group Broadcast Detection

Lines 306-308:

```python
mentions = extract_mentions(memory.content)
is_broadcast = "broadcast" in tags or "all" in mentions
```

**Triggers broadcast mode:**
- Tag: `{"tags": ["broadcast"]}`
- Mention: Text contains `@all`

In broadcast mode, **all board leads** in group receive message (not just mentioned ones).

---

## 8. Data Models Summary

### BoardMemory

**File:** `/backend/app/models/board_memory.py`

```python
class BoardMemory(QueryModel, table=True):
    id: UUID (PK)
    board_id: UUID (FK, indexed)
    content: str
    tags: list[str] | None (JSON, nullable)
    is_chat: bool (indexed, default=False)
    source: str | None (actor display name)
    created_at: datetime
```

**Key Fields:**
- `is_chat`: Set to True when `"chat"` in tags
- `source`: Auto-populated from actor name if not provided
- `tags`: Payload tags (e.g., `["chat"]`)

### Agent (Relevant Fields)

**File:** `/backend/app/models/agents.py`

```python
class Agent(QueryModel, table=True):
    id: UUID (PK)
    board_id: UUID | None (FK, indexed)
    name: str (indexed)
    status: str (indexed)
    openclaw_session_id: str | None (indexed)
    is_board_lead: bool (indexed, default=False)
    # ... other fields ...
```

**Routing-Critical Fields:**
- `is_board_lead`: Boolean routing flag
- `openclaw_session_id`: Session key for gateway dispatch
- `name`: Used for mention matching
- `board_id`: Links agent to board

### ActorContext

**File:** `/backend/app/api/deps.py`

```python
@dataclass
class ActorContext:
    actor_type: Literal["user", "agent"]
    user: User | None = None
    agent: Agent | None = None
```

Used to determine sender type and exclude self-messages.

---

## 9. Frontend Mention UI

**File:** `/frontend/src/components/BoardChatComposer.tsx`

### Mention Pattern (Client-Side)

```typescript
const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_-]{0,31})$/;

const normalizeMentionHandle = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/^@+/, "");
  const token = trimmed.split(/\s+/)[0]?.replace(/[^A-Za-z0-9_-]/g, "") ?? "";
  if (!/^[A-Za-z]/.test(token)) return null;
  return token.slice(0, 32).toLowerCase();
};
```

**Differences from Backend:**
- Client allows numeric first char match initially but filters in normalization
- Same 1-32 char limit, lowercase normalization

### Mention Suggestions

Lines 63-72: Built dynamically from agent list + reserved `"lead"`:

```typescript
const mentionOptions = useMemo(() => {
  const handles = new Set<string>(["lead"]);
  (mentionSuggestions ?? []).forEach((candidate) => {
    const handle = normalizeMentionHandle(candidate);
    if (handle) {
      handles.add(handle);
    }
  });
  return [...handles];
}, [mentionSuggestions]);
```

**Always includes:**
- `"lead"` (special shortcut)
- Agent names from `mentionSuggestions` prop

### Autocomplete Menu

Lines 229-252: Shows matching handles, scrollable to 8 items max:

```typescript
const filteredMentionOptions = useMemo(() => {
  if (!mentionTarget) return [];
  const query = mentionTarget.query;
  const startsWithMatches = mentionOptions.filter((option) =>
    option.startsWith(query),
  );
  return startsWithMatches.slice(0, MENTION_MAX_OPTIONS);
}, [mentionOptions, mentionTarget]);
```

Keyboard navigation (arrow up/down, enter to select, escape to close).

---

## 10. Message Flow Diagram

```
┌─────────────────────────────────────┐
│  POST /api/v1/boards/{id}/memory    │
│  Body: {                            │
│    content: "Hey @alice",           │
│    tags: ["chat"]                   │
│  }                                  │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────────┐
        │ is_chat = True?  │ (line 282)
        │ "chat" in tags   │
        └────────┬─────────┘
                 │ YES
                 ▼
        ┌───────────────────┐
        │ Create BoardMemory│
        │ Persist to DB     │
        └────────┬──────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │ _notify_chat_targets()        │
    │ - Load all board agents       │
    │ - Extract mentions: {"alice"} │
    │ - Resolve targets:            │
    │   * Board leads (always)      │
    │   * Mentioned agents          │
    │   * Exclude sender if agent   │
    └──────────────┬────────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ For each target agent:    │
        │ - Format message          │
        │ - Include header/board/   │
        │   sender/snippet/reply-   │
        │   instructions            │
        └──────────────┬─────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ dispatch.try_send_agent_     │
        │   message(                   │
        │   session_key=sessionId,     │
        │   config=gatewayConfig,      │
        │   agent_name=name,           │
        │   message=formatted,         │
        │ )                            │
        └──────────────┬────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ OpenClaw Gateway RPC         │
        │ Delivers to agent session    │
        │ (fails silently if no session)
        └──────────────────────────────┘
```

---

## 11. Special Cases & Edge Cases

### No Gateway Configured

Line 164: `if config is None: return`

- If board has no `gateway_id`, dispatch silently exits
- Agents don't receive notifications (no routing error logged)
- Memory still persists to DB

### Inactive Agents (No Session)

Lines 196, 218: `if not agent.openclaw_session_id: continue`

- Agents without active `openclaw_session_id` are skipped
- Message not queued for later delivery
- Memory entry still created

### Control Commands

Lines 169-180: `/pause` and `/resume` are special:

- Broadcast to **all** agents on board (not just leads + mentioned)
- Skip mention extraction entirely
- Use `deliver=True` flag to ensure delivery
- Normalized to lowercase comparison

### Sender Exclusion

Line 141: If actor is an agent, remove themselves from targets

```python
if actor.actor_type == "agent" and actor.agent:
    targets.pop(str(actor.agent.id), None)
```

Prevents agent from receiving own message.

### Empty/Whitespace-Only Content

Lines 85-87 (list endpoint), 232 (create endpoint):

```python
.filter(func.length(func.trim(col(BoardMemory.content))) > 0)
```

Excludes invalid entries from API responses. Creates still validate via `NonEmptyStr` schema.

---

## 12. Test Coverage

**File:** `/backend/tests/test_mentions.py`

```python
def test_extract_mentions_parses_tokens():
    assert extract_mentions("hi @Alex and @bob-2") == {"alex", "bob-2"}

def test_matches_agent_mention_matches_first_name():
    agent = _agent("Alice Cooper")
    assert matches_agent_mention(agent, {"alice"}) is True
    assert matches_agent_mention(agent, {"cooper"}) is False

def test_matches_agent_mention_supports_reserved_lead_shortcut():
    lead = _agent("Riya", is_board_lead=True)
    other = _agent("Lead", is_board_lead=False)
    assert matches_agent_mention(lead, {"lead"}) is True
    assert matches_agent_mention(other, {"lead"}) is False
```

Validates:
- Mention extraction (lowercase, tokenization)
- First-name matching for multi-word names
- Lead shortcut only works for actual leads

---

## 13. API Payload Reference

### Create Board Chat Entry

**Endpoint:** `POST /api/v1/boards/{board_id}/memory`

**Request:**
```json
{
  "content": "Hey @alice, can you check this?",
  "tags": ["chat"],
  "source": null  // Optional, auto-filled
}
```

**Response:**
```json
{
  "id": "uuid",
  "board_id": "uuid",
  "content": "Hey @alice, can you check this?",
  "tags": ["chat"],
  "is_chat": true,
  "source": "User Name",
  "created_at": "2026-03-23T20:50:00"
}
```

### Create Group Chat Entry

**Endpoint:** `POST /boards/{board_id}/group-memory`

**Request:**
```json
{
  "content": "@all check the latest update",
  "tags": ["chat"]  // Or ["broadcast"] for group broadcast
}
```

**Broadcast example:**
```json
{
  "content": "This is a broadcast",
  "tags": ["broadcast"]
}
```

---

## 14. Security & Permission Model

### Actors Allowed on Chat Endpoints

**File:** `/backend/app/api/deps.py` - `require_user_or_agent` (line 67)

- Human users (via user token)
- Authenticated agents (via `X-Agent-Token` or `Authorization` header)
- No anonymous access

### Board Access Validation

- Users must have board read/write access
- Agents validated via `ActorContext` in dependencies
- Same endpoint for both user and agent callers

### No Broadcast Denial

- Lead agents always receive messages (no opt-out)
- Member agents can ignore mentions (no "quiet mode")
- User-to-agent dispatch uses same gateway for all agents

---

## 15. Performance Characteristics

### Mention Extraction

- O(n) regex scan of message content
- Set-based deduplication: `{"alice", "bob"}`
- No database queries

### Chat Target Resolution

- O(m) loop through board agents
- Mention matching O(1) per agent
- Single database query to load agents per board

### Dispatch

- Parallel sends possible but not implemented
- Sequential `try_send_agent_message` calls
- Gateway RPC is async but awaited for each agent
- Fail-open: errors logged/ignored, don't block response

### Database

- Single insert per message: `BoardMemory`
- No transaction complexity
- Response sent before agent dispatch completes

---

## 16. Known Limitations & Gaps

1. **No Message Queuing**: Inactive agents miss messages (no retry)
2. **No Read Receipts**: Dispatch status not returned to sender
3. **No Threading**: Each message independent, no conversation grouping
4. **No Rich Mentions**: Only name-based, no groups/roles
5. **Single Lead per Board**: Model allows multiples but UX assumes one
6. **No Rate Limiting**: No mention spam detection
7. **Silent Failures**: Gateway errors logged only internally
8. **No Message Expiry**: Old board memory persists indefinitely

---

## 17. Related Files Summary

| File | Purpose | Lines | Key Function |
|------|---------|-------|--------------|
| `board_memory.py` (API) | Board chat endpoint | 274-306 | `create_board_memory()` |
| `mentions.py` | Mention extraction/matching | 1-41 | `extract_mentions()`, `matches_agent_mention()` |
| `board_group_memory.py` | Group chat routing | 209-348 | `_group_chat_targets()`, `_notify_group_memory_targets()` |
| `gateway_dispatch.py` | Gateway client service | 41-72 | `try_send_agent_message()` |
| `deps.py` | Auth context resolution | 67-92 | `require_user_or_agent()` |
| `BoardChatComposer.tsx` | Frontend mention UI | 1-267 | Autocomplete, mention input |

---

## 18. Unresolved Questions

1. **Multi-Lead Behavior**: What happens if multiple agents have `is_board_lead=True`? All receive messages?
2. **Gateway Fallback**: Is there a retry mechanism if gateway dispatch fails?
3. **Message Ordering**: Are messages ordered by `created_at` on agent side? Timestamp precision?
4. **Broadcast Rate Limiting**: Can a single broadcast reach thousands of agents without throttling?
5. **Lead Auto-Assignment**: How is `is_board_lead` set during agent provisioning?
6. **First-Name Collision**: If two agents have same first name, does `@alice` mention both or first added?
7. **Session ID Lifecycle**: When is `openclaw_session_id` cleared? On agent offline/deletion?
8. **Group vs Board Preference**: If agent in group AND board, which chat endpoint should they use?
9. **Mention Performance**: Regex extraction cost for very large messages (10k+ chars)?
10. **Idempotency**: If same message posted twice, are duplicate notifications sent?

---

## Conclusion

OpenClaw implements a **clean, deterministic mention-based routing system** for agent board chat. Core logic:

- **Board leads always receive messages**
- **Member agents only if explicitly mentioned**
- **Mentions are case-insensitive, first-name-matching for display names**
- **`@lead` is reserved shortcut for board lead**
- **Dispatch via OpenClaw Gateway RPC to agent session IDs**
- **Group chat extends board logic with broadcast support**

Routing happens at **notification time** (not persistence), enabling future complexity (rules, channels, threading) without data migration.

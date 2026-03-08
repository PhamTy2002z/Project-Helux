# Brainstorm Report: Board Chat Multi-Session

## Problem
Need board chat supports many chat sessions, with:
- create new chat session
- delete old chat session
- rename chat session
- UI/UX clean, low friction
- fix annoying load behavior: when open chat, currently scroll from top to bottom; must show latest immediately.

Current state observed:
- Chat data uses `board_memory` rows (`is_chat=true`) without session concept.
- UI auto-scroll logic always runs smooth scroll after render, causes visible top->bottom jump.
- Board snapshot preloads chat messages even when chat panel closed.

## Approaches Evaluated

### A) Frontend-only sessioning (local grouping, no DB change)
Idea:
- Keep backend same.
- Session list stored in localStorage + map message IDs to sessions.

Pros:
- Fastest ship.
- No migration, no API change.

Cons:
- Not persistent cross-device/user.
- Delete/rename unreliable for team usage.
- Agent replies and SSE cannot be filtered by session robustly.
- Technical debt high.

Verdict: reject.

### B) Add `chat_session_id` to `board_memory` + new `board_chat_sessions` table (recommended)
Idea:
- Keep memory pipeline, add first-class session entity.
- Chat read/write/stream filter by `chat_session_id`.
- Session CRUD endpoints for list/create/rename/delete.

Pros:
- Minimal disruption to existing chat pipeline.
- Cleanly supports required features.
- Supports SSE per session.
- Scales with indexing and pagination.

Cons:
- Needs migration + API version evolution.
- Must handle legacy rows and agent messages with missing session id.

Verdict: best balance.

### C) New chat domain/service separate from board memory
Idea:
- Create dedicated chat message table/service, leave board_memory for non-chat context.

Pros:
- Best long-term domain separation.
- Cleaner semantics.

Cons:
- Big refactor, many touchpoints, high regression risk.
- Slower delivery for current scope.

Verdict: overkill now (violates YAGNI).

## Recommended Solution (B)

### Data model
1. Create table `board_chat_sessions`:
- `id` UUID pk
- `board_id` fk index
- `title` text
- `created_by` fk user nullable
- `created_at`, `updated_at`

2. Add nullable `chat_session_id` to `board_memory`:
- fk to `board_chat_sessions.id`
- index: `(board_id, is_chat, chat_session_id, created_at)`

3. Legacy compatibility:
- Create one default session per board (`"General"`) during migration/backfill.
- Backfill old `is_chat=true` rows to that default session.

### API contract
Add endpoints:
- `GET /api/v1/boards/{board_id}/chat-sessions`
- `POST /api/v1/boards/{board_id}/chat-sessions`
- `PATCH /api/v1/boards/{board_id}/chat-sessions/{session_id}` (rename)
- `DELETE /api/v1/boards/{board_id}/chat-sessions/{session_id}`

Extend existing board memory APIs:
- list/stream accepts `chat_session_id`
- create accepts `chat_session_id`

Behavior:
- If `is_chat=true` and no `chat_session_id`, fallback to board default session.
- SSE streams only selected session when `chat_session_id` provided.

### UI/UX
Panel split 2 columns (desktop):
- Left: session list + `New chat` button + kebab menu (`Rename`, `Delete`).
- Right: messages + composer.

Mobile:
- Session list as drawer/sheet.
- Keep message area uncluttered.

Interaction rules:
- New chat: create session, auto-select, focus composer.
- Rename: inline edit in list row.
- Delete: confirm modal + safe fallback select nearest session.
- Empty states short and actionable.

### Load/scroll optimization (fix current annoyance)
1. Remove always-smooth autoscroll effect on every `chatMessages` update.
2. Use container ref + `useLayoutEffect` to jump to bottom **without animation** on:
- first open of a session
- switching sessions
3. Auto-scroll smooth only for truly new incoming message and only when user is near bottom.
4. Lazy load chat data only when chat panel open (do not preload full chat in board snapshot).
5. Fetch latest page first (`limit 50`) + upward pagination for older messages.

## Risks & mitigations
- Agent replies may miss session id.
  - Mitigation: backend fallback to default session; later improve prompts/tools to pass session id.
- Delete semantics may conflict audit expectations.
  - Mitigation: define policy now (hard delete vs archive). If compliance needed, archive + hide.
- Large board page already huge.
  - Mitigation: extract `BoardChatPanel`, `ChatSessionList`, `useBoardChatSessions` hook to isolate complexity.

## Success metrics
- Open chat shows latest messages immediately (no visible top->bottom animation).
- P95 chat panel open time < 300ms for session list + first message paint.
- Session CRUD success rate > 99% (create/rename/delete).
- No duplicate SSE messages after reconnect.
- No regression in `/pause` `/resume` command flow.

## Dependencies
- Alembic migration
- OpenAPI regen (`make api-gen`)
- Frontend query key updates and cache invalidation strategy
- Regression tests backend + frontend

## Suggested rollout
1. Backend schema + APIs + migration + tests.
2. Frontend session list + CRUD UX + selected session state.
3. Scroll/load optimization.
4. Dogfood with real boards, tune UX copy and empty states.

## Unresolved questions
- Delete means hard-delete messages or archive-hide only?
- Session title auto rule: first user message as title, or fixed "New chat" until rename?
- `/pause` and `/resume` should be global board state or tied to selected session?

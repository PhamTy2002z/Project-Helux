# Phase 2: Backend Chat Session APIs and Memory Filters

## Context Links

- Plan overview: [plan.md](./plan.md)
- Phase 1 schema: [phase-01](./phase-01-schema-and-migration-foundation.md)
- Current API surface: `backend/app/api/board_memory.py`, `backend/app/api/boards.py`
- Snapshot builder: `backend/app/services/board_snapshot.py`

## Overview

- **Priority:** P1
- **Status:** Completed
- **Description:** Add CRUD endpoints for chat sessions and make board memory APIs session-aware.

## Key Insights

- Existing frontend already calls memory list/create/stream and snapshot chat payload.
- `/pause` and `/resume` rely on chat memory history, must not regress.
- Session filtering should be optional to avoid breaking older clients.

## Requirements

Functional:

- Provide list/create/rename/delete endpoints for chat sessions.
- `DELETE` endpoint archives session (`archived_at`), not hard-deletes rows.
- No restore endpoint in v1 scope (can add later if required).
- Extend memory list/create/stream with `chat_session_id` support.
- Default missing session to board default chat session for chat messages.
- Auto-title `New chat` session from first meaningful user message if untouched.

Non-functional:

- API stays backward compatible.
- SSE reconnect remains stable with existing `since` cursor logic.

## Architecture

- New router: `boards/{board_id}/chat-sessions`.
- Session list returns non-archived sessions by default.
- Memory API updates:

1. `GET /memory`: optional `chat_session_id` filter when `is_chat=true`.
2. `POST /memory`: accept `chat_session_id`; fallback to default session if missing.
3. `GET /memory/stream`: optional `chat_session_id` filter for SSE events.

- Session delete behavior:

1. Mark `archived_at`.
2. Keep messages and session row for audit/history.

- Auto-title rule:

1. Trigger only when title is still `New chat`.
2. Ignore command messages (`/pause`, `/resume`) and blank/mention-only content.

- Snapshot strategy:
- return default-session recent chat by default (or explicitly selected later by frontend query path).

## Related Code Files

Modify:

- `backend/app/api/board_memory.py`
- `backend/app/schemas/board_memory.py`
- `backend/app/services/board_snapshot.py`
- `backend/app/main.py` (include new router tags)

Create:

- `backend/app/api/board_chat_sessions.py`
- `backend/app/schemas/board_chat_sessions.py`
- Optional service helper: `backend/app/services/board_chat_sessions.py`

Delete:

- None.

## Implementation Steps

1. Add session schemas (create/read/update).
2. Implement session CRUD endpoints with board access checks.
3. Extend memory schemas and endpoint params for `chat_session_id`.
4. Apply session filter in list/stream query builders.
5. Keep default-session fallback in create path.
6. Add auto-title update rule for `New chat` after first meaningful user message.
7. Implement delete-as-archive semantics in session endpoint.
8. Verify `/pause` `/resume` lookup stays global board semantics.

## Todo List

- [x] Session CRUD endpoints implemented.
- [x] Delete endpoint archives instead of hard delete.
- [x] Memory endpoints accept/filter session id.
- [x] Auto-title rule implemented and covered.
- [x] SSE session filtering tested.
- [x] Backward compatibility for no-session clients validated.

## Success Criteria

- API supports multi-session operations end-to-end.
- Existing callers without `chat_session_id` still work.
- No regression in agent chat notification flow.

## Risk Assessment

- Risk: behavior drift between snapshot and direct memory queries.
- Mitigation: document and align default session retrieval contract.

## Security Considerations

- Enforce board-level authorization on session CRUD.
- Validate `chat_session_id` belongs to board before create/read/stream.

## Next Steps

- Phase 3 consumes new APIs in frontend query and state layer.

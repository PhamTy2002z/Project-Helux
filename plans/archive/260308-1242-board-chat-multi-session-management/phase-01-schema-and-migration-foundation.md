# Phase 1: Schema and Migration Foundation

## Context Links

- Plan overview: [plan.md](./plan.md)
- Brainstorm basis: [brainstorm report](../reports/brainstorm-260308-1239-board-chat-multi-session.md)
- Current models: `backend/app/models/board_memory.py`, `backend/app/models/boards.py`
- Existing memory index migration: `backend/migrations/versions/99cd6df95f85_add_indexes_for_board_memory_task_.py`

## Overview

- **Priority:** P1
- **Status:** Completed
- **Description:** Add first-class chat session entity and migrate legacy chat rows safely.

## Key Insights

- Current chat uses `board_memory` only (`is_chat=true`) with no session key.
- Existing index optimized for `(board_id, is_chat, created_at)`; session-aware queries need stronger composite index.
- Must preserve historical chat behavior and minimize risk to board snapshot path.

## Requirements

Functional:

- Add table `board_chat_sessions` tied to board.
- Add nullable `chat_session_id` in `board_memory`.
- Add archive marker for sessions (`archived_at`) to support delete-as-archive behavior.
- Backfill existing chat rows into default session per board.

Non-functional:

- Migration safe for existing data.
- Query performance remains stable on large boards.

## Architecture

- New table `board_chat_sessions(id, board_id, title, created_by, created_at, updated_at, archived_at)`.
- `board_memory.chat_session_id` FK -> `board_chat_sessions.id`.
- Backfill flow:

1. Create default session (`General`) for each board with chat rows.
2. Populate `chat_session_id` for legacy `is_chat=true` rows.
3. Add composite index for session-filtered listing.

## Related Code Files

Modify:

- `backend/app/models/board_memory.py`
- `backend/app/models/__init__.py`

Create:

- `backend/app/models/board_chat_sessions.py`
- `backend/migrations/versions/*_add_board_chat_sessions.py`

Delete:

- None.

## Implementation Steps

1. Define new SQLModel for chat sessions with board FK + metadata.
2. Extend `BoardMemory` with nullable `chat_session_id` and FK.
3. Include `archived_at` column on session model for soft delete.
4. Write Alembic migration to create table/column/indexes.
5. Backfill existing rows with deterministic default session.
6. Validate migration downgrade path.

## Todo List

- [x] New model created and imported.
- [x] Migration includes create + backfill + indexes.
- [x] Archive marker behavior wired in schema.
- [x] Legacy chat rows mapped.
- [x] Backward-compatible defaults verified.

## Success Criteria

- All `is_chat=true` rows have valid session reference after migration/backfill.
- Queries by board + session are index-backed.
- Existing board data remains intact.

## Risk Assessment

- Risk: long-running update on large `board_memory`.
- Mitigation: indexed update strategy + transaction-aware batching if needed.

## Security Considerations

- Enforce board ownership boundaries via FK path.
- Ensure no cross-board session assignment possible.

## Next Steps

- Phase 2 consumes new schema in API layer.

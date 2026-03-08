---
title: "Board Chat Multi-Session Management"
description: "Implement multi-session board chat with create/archive/rename, auto-title, and non-janky latest-first loading"
status: completed
priority: P1
effort: 7d
tags: [feature, backend, frontend, chat, ux, performance]
created: 2026-03-08
---

# Board Chat Multi-Session Management

## Overview

Goal: board chat supports multiple sessions with clean UX and fast latest-first loading.

Scope:

- New chat session
- Rename chat session
- Delete old chat session (implemented as archive-hide)
- Session-aware message read/write/stream
- Remove top->bottom scroll jump and optimize first paint

Out of scope:

- Rebuild full chat domain outside board memory
- LLM summarization/search across sessions

## Phases

| #   | Phase                                           | Status    | Effort | Link                                                                       |
| --- | ----------------------------------------------- | --------- | ------ | -------------------------------------------------------------------------- |
| 1   | Schema + migration foundation                   | Completed | 1.5d   | [phase-01](./phase-01-schema-and-migration-foundation.md)                  |
| 2   | Backend APIs for chat sessions + memory filters | Completed | 1.5d   | [phase-02](./phase-02-backend-chat-session-apis-and-memory-filters.md)     |
| 3   | Frontend data layer + panel structure refactor  | Completed | 1.5d   | [phase-03](./phase-03-frontend-data-layer-and-chat-panel-refactor.md)      |
| 4   | UX flows for create/rename/delete sessions      | Completed | 1d     | [phase-04](./phase-04-chat-session-crud-ux-and-interaction-polish.md)      |
| 5   | Load/scroll optimization + latest-first paging  | Completed | 1d     | [phase-05](./phase-05-load-scroll-optimization-and-latest-first-paging.md) |
| 6   | Tests, regression hardening, docs sync          | Completed | 0.5d   | [phase-06](./phase-06-tests-regression-and-docs-sync.md)                   |

## Dependency Graph

Critical path: Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6

## Acceptance Criteria

- Users can create, rename, and delete (archive-hide) chat sessions from board chat panel.
- Message read/write/stream is isolated by selected session.
- First open/switch session lands at latest message immediately (no visible jump).
- Older history loads on demand without blocking initial message paint.
- New sessions start with `New chat` and auto-title from first meaningful user message unless renamed manually.
- Existing `/pause` and `/resume` behavior remains correct.

## Key Risks

- Legacy chat rows without `chat_session_id`.
- Session archive visibility and discoverability in future admin tooling.
- Regression in agent-notification flow on chat create.

## References

- Brainstorm report: [brainstorm-260308-1239-board-chat-multi-session.md](../reports/brainstorm-260308-1239-board-chat-multi-session.md)
- Board page: `frontend/src/app/boards/[boardId]/page.tsx`
- Memory API: `backend/app/api/board_memory.py`

## Decisions

- Delete session action uses archive-hide semantics (soft delete), not hard-delete.
- No restore endpoint in v1 scope.
- New sessions default to `New chat`; auto-title after first meaningful user message if title untouched.
- `/pause` and `/resume` stay global board controls, not scoped by chat session.

## Unresolved Questions

- None at planning stage.

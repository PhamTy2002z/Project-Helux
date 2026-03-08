# Phase 3: Frontend Data Layer and Chat Panel Refactor

## Context Links

- Plan overview: [plan.md](./plan.md)
- Board page: `frontend/src/app/boards/[boardId]/page.tsx`
- Composer: `frontend/src/components/BoardChatComposer.tsx`
- API generated client: `frontend/src/api/generated/`

## Overview

- **Priority:** P1
- **Status:** Completed
- **Description:** Refactor chat panel into session-aware structure with isolated state and cleaner composition.

## Key Insights

- Board page is large and currently owns all chat state inline.
- Session UX needs dedicated left rail + thread area.
- Query keys must include `chat_session_id` to avoid cache bleeding.

## Requirements

Functional:

- Load and render chat session list.
- Persist selected session in component state (optionally URL param).
- Thread reads/writes/streams bound to selected session.

Non-functional:

- Keep UI responsive on panel open.
- Avoid increasing complexity in already large board page.

## Architecture

- Extract components/hooks:

1. `BoardChatPanel` (container)
2. `BoardChatSessionList` (left rail)
3. `BoardChatThread` (message list + composer)
4. `useBoardChatSessions` (session CRUD/query state)
5. `useBoardChatMessages` (message query + stream merge)

Data flow:

- Open panel -> fetch sessions -> select active session -> fetch latest messages -> attach session-scoped SSE stream.

## Related Code Files

Modify:

- `frontend/src/app/boards/[boardId]/page.tsx`
- `frontend/src/components/BoardChatComposer.tsx` (only if prop surface needs session metadata)

Create:

- `frontend/src/components/boards/BoardChatPanel.tsx`
- `frontend/src/components/boards/BoardChatSessionList.tsx`
- `frontend/src/components/boards/BoardChatThread.tsx`
- `frontend/src/lib/hooks/use-board-chat-sessions.ts`
- `frontend/src/lib/hooks/use-board-chat-messages.ts`

Delete:

- None.

## Implementation Steps

1. Regenerate API client after backend changes (`make api-gen`).
2. Build session hooks (list/create/rename/delete-as-archive with cache invalidation).
3. Build message hook with session-aware list/create/stream.
4. Move chat panel JSX/state from board page into new components.
5. Keep board page controls wiring (`openBoardChat`, `closeBoardChat`) stable.

## Todo List

- [x] API client regenerated.
- [x] Session hooks implemented.
- [x] Message hooks implemented with session-aware query keys.
- [x] Board page reduced and chat responsibilities moved.

## Success Criteria

- Session switching updates thread correctly with no stale bleed.
- Panel structure remains consistent desktop + mobile.
- Board page complexity reduced materially.

## Risk Assessment

- Risk: refactor introduces state sync bugs with URL panel params.
- Mitigation: keep URL ownership in board page, pass simple props to panel.

## Security Considerations

- Do not trust client-side session IDs; rely on backend validation.
- Surface API authorization errors clearly without leaking details.

## Next Steps

- Phase 4 adds polished CRUD interactions on top of refactored panel.

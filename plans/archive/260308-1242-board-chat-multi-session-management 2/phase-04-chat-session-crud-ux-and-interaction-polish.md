# Phase 4: Chat Session CRUD UX and Interaction Polish

## Context Links
- Plan overview: [plan.md](./plan.md)
- Phase 3 refactor: [phase-03](./phase-03-frontend-data-layer-and-chat-panel-refactor.md)
- Design guidance: `docs/design-guidelines.md`

## Overview
- **Priority:** P1
- **Status:** Completed
- **Description:** Deliver clean, low-friction UX for create, rename, delete chat sessions.

## Key Insights
- Session actions should be one-click discoverable, not hidden deeply.
- Rename must be in-place and reversible quickly.
- Delete must be safe and predictable with explicit confirmation.

## Requirements
Functional:
- `New chat` creates session titled `New chat` and auto-focuses composer.
- Auto-title from first meaningful user message if user has not renamed.
- Rename available from row action menu; inline edit submit/cancel supported.
- Delete available from row action menu; confirm dialog and fallback session selection.
- Delete interaction maps to archive-hide behavior (messages retained).

Non-functional:
- UI must remain calm/clean, no accidental destructive actions.
- Works on desktop and mobile layouts.

## Architecture
Interaction model:
1. Session row select sets active thread.
2. Row menu provides `Rename` and `Delete`.
3. Inline rename uses optimistic UI with rollback on API error.
4. Delete flow archives session and selects nearest valid session after success.

Accessibility:
- Keyboard navigation in session list.
- Proper ARIA labels for action buttons and dialogs.

## Related Code Files
Modify:
- `frontend/src/components/boards/BoardChatSessionList.tsx`
- `frontend/src/components/boards/BoardChatPanel.tsx`

Create:
- Optional shared dialog component only if reuse exists.

Delete:
- None.

## Implementation Steps
1. Add session list item interactions and menu actions.
2. Implement inline rename form state and optimistic mutation.
3. Implement delete confirm modal with explicit impact copy (`This hides the session from list, messages kept.`).
4. Add empty states and disabled states for read-only users.
5. Verify mobile behavior (drawer/sheet session list).

## Todo List
- [x] New chat flow polished.
- [x] Auto-title behavior represented clearly in UI state.
- [x] Inline rename with error handling.
- [x] Delete confirmation + fallback selection.
- [x] Keyboard and screen reader behavior validated.

## Success Criteria
- Session CRUD interactions are fast and predictable.
- No accidental session deletion from misclick.
- Delete action behavior is clear: archive-hide, not hard delete.
- UX remains clean in dense board contexts.

## Risk Assessment
- Risk: optimistic updates diverge from server state.
- Mitigation: invalidate/refetch session list on mutation settle.

## Security Considerations
- Respect `canWrite` and role permissions on all destructive UI actions.
- Do not expose mutation actions in read-only state.

## Next Steps
- Phase 5 tunes performance + scroll behavior for thread rendering.

# Phase 7: Frontend Chat File UI

## Context Links
- [Board chat panel](../../frontend/src/components/boards/BoardChatPanel.tsx)
- [Board chat thread](../../frontend/src/components/boards/BoardChatThread.tsx)
- [Board chat composer](../../frontend/src/components/BoardChatComposer.tsx)
- [Chat messages hook](../../frontend/src/lib/hooks/use-board-chat-messages.ts)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 4h

Implement upload UX and file/report visibility in board chat panel.

## Key Insights
- Current composer supports text + mentions only.
- Current thread message card has no attachment section.
- Requirement #4 needs persistent file status visibility, not transient toasts.

## Requirements
- Functional:
  - Upload files from composer (click + drag/drop).
  - Show selected file chips before send.
  - Send chat message with `file_ids`.
  - Render attachment chips in message cards.
  - Render file/report drawer with extraction + per-agent statuses.
- Non-functional:
  - Mobile-safe layout in existing right-side panel.
  - Clear pending/error states for uploads and report generation.

## Architecture
- UI components:
  - `BoardChatFilePicker`
  - `BoardChatAttachmentChips`
  - `BoardChatFilesDrawer`
- Hook changes:
  - `useBoardChatMessages.sendMessage(content, fileIds?)`
  - Add upload helper hook for multipart endpoint.
- Data flow:
  - Upload files first -> receive `file_ids` -> send chat message -> subscribe to status updates via SSE/poll.

## Related Code Files
### Files to modify:
- `frontend/src/components/BoardChatComposer.tsx`
- `frontend/src/components/boards/BoardChatThread.tsx`
- `frontend/src/components/boards/BoardChatPanel.tsx`
- `frontend/src/lib/hooks/use-board-chat-messages.ts`

### Files to create:
- `frontend/src/components/boards/BoardChatFilePicker.tsx`
- `frontend/src/components/boards/BoardChatFilesDrawer.tsx`
- `frontend/src/lib/hooks/use-board-chat-files.ts`

### Files to delete:
- None.

## Implementation Steps
1. Add composer file picker with allowlist and max-size client-side validation.
2. Implement multipart upload call and optimistic chip state (`uploading|ready|failed`).
3. Extend send message to include uploaded `file_ids`.
4. Render message attachment chips with extraction/report badges.
5. Add drawer panel listing files + latest summary + per-agent status timeline.
6. Add refresh strategy (query invalidation + lightweight polling for task/report states).
7. Ensure mobile behavior: drawer collapses below thread on small screens.

## Todo List
- [ ] Composer upload UI implemented.
- [ ] Upload + send orchestration implemented.
- [ ] Message attachment rendering implemented.
- [ ] Files/report drawer implemented.
- [ ] Error and retry UX implemented.

## Success Criteria
- User can upload file, send message, and see file attached in chat.
- User can inspect processing state and report output in drawer.
- UI remains usable on desktop and mobile widths.

## Risk Assessment
- Risk: upload progress UX feels laggy with large files.
  - Mitigation: show deterministic status chips and retry action.
- Risk: status drift between thread and drawer.
  - Mitigation: single source query hook and shared cache keys.

## Security Considerations
- Client-side validation is advisory only; backend remains authority.
- Never expose secret object-storage credentials in frontend.

## Next Steps
- Phase 8 validates with backend/frontend tests and rollout checklist.

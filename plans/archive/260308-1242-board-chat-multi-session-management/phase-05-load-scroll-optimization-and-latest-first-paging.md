# Phase 5: Load/Scroll Optimization and Latest-First Paging

## Context Links

- Plan overview: [plan.md](./plan.md)
- Current jank source: `frontend/src/app/boards/[boardId]/page.tsx` (smooth scroll effect)
- Memory APIs: `backend/app/api/board_memory.py`

## Overview

- **Priority:** P1
- **Status:** Completed
- **Description:** Remove chat open/switch scroll jank and optimize first-thread paint for latest messages.

## Key Insights

- Current effect smooth-scrolls every message update, causing visible jump.
- Loading full chat in snapshot is expensive and unnecessary when panel closed.
- Fast UX needs latest chunk first, older history deferred.

## Requirements

Functional:

- On first open/switch session, show latest messages immediately at bottom.
- Support loading older messages on demand.
- SSE appends new messages without forcing jump if user reading older content.
- Preserve global `/pause` and `/resume` control visibility regardless of selected session.

Non-functional:

- Improve perceived load speed and reduce layout shifts.
- Avoid excessive re-render and duplicate merge logic.

## Architecture

Scroll strategy:

1. Use thread container ref instead of sentinel smooth scroll for initial placement.
2. `useLayoutEffect` immediate bottom placement on initial mount/session switch.
3. Auto-scroll only when new message arrives and user is near bottom threshold.

Data strategy:

- Query latest page first (`limit=50`, offset 0 with descending API, then normalize for render).
- Add "Load older" pagination for historical pages.
- Defer chat fetch until panel open.

## Related Code Files

Modify:

- `frontend/src/components/boards/BoardChatThread.tsx`
- `frontend/src/lib/hooks/use-board-chat-messages.ts`
- `backend/app/services/board_snapshot.py` (optional reduction of preloaded chat)

Create:

- None required.

Delete:

- Remove old unconditional smooth-scroll effect path from board page after refactor.

## Implementation Steps

1. Implement near-bottom detection helper.
2. Replace unconditional smooth-scroll with conditional strategy.
3. Add first-load immediate bottom placement.
4. Add incremental older-history fetch UX.
5. Measure and validate no visible top->bottom jump.

## Todo List

- [x] Initial open/switch no-jank bottom placement.
- [x] Conditional autoscroll for new messages only.
- [x] Older-page fetch path implemented.
- [x] Snapshot preload reassessed/trimmed.

## Success Criteria

- Chat opens at latest position instantly.
- No visible top-to-bottom scrolling animation on initial display.
- Users can read backlog without forced snap-to-bottom.

## Risk Assessment

- Risk: edge cases with variable-height messages during first layout.
- Mitigation: layout effect timing + retry once after image/font settle if needed.

## Security Considerations

- None beyond existing auth controls; ensure no bypass in paginated endpoints.

## Next Steps

- Phase 6 validates regressions and updates docs/changelog.

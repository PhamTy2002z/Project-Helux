# Phase 05 - Frontend Scalable Board Views And Interactions

## Context Links
- `frontend/src/app/(app)/boards/[boardId]/page.tsx`
- `frontend/src/components/organisms/TaskBoard.tsx`
- `frontend/src/components/molecules/TaskCard.tsx`
- `frontend/src/lib/`

## Overview
- Priority: P1
- Status: Completed
- Scope: scalable board visualization + interaction without changing task execution semantics.

## Key Insights
- Current board view renders all tasks and has only local review filter.
- Need focus workflows: global filters, saved views, group collapse, density modes.

## Requirements
- Functional:
  1. Add global filter bar and saved views.
  2. Render task groups with collapse/expand and progress rollup.
  3. Support density modes and done-lane compression.
  4. Preserve drag/drop status updates via existing mutation path.
- Non-functional:
  1. Smooth interaction at 300+ tasks.
  2. Accessibility and keyboard navigation preserved.

## Architecture
- `BoardViewModel` layer maps API payload to grouped render tree.
- Virtualized column/task list for large datasets.
- Feature flag switch between legacy board and overlay board.

## Related Code Files
- Modify:
  - `frontend/src/app/(app)/boards/[boardId]/page.tsx`
  - `frontend/src/components/organisms/TaskBoard.tsx`
  - `frontend/src/components/molecules/TaskCard.tsx`
- Create:
  - `frontend/src/components/organisms/task-board-filter-bar.tsx`
  - `frontend/src/components/organisms/task-group-column-section.tsx`
  - `frontend/src/lib/boards/board-query-state.ts`
  - `frontend/src/lib/boards/board-view-model.ts`
- Delete:
  - none

## Implementation Steps
1. Add global query state + URL sync for filters/saved views.
2. Implement grouped rendering and collapse behavior.
3. Add virtualization and lazy card detail hydration.
4. Keep mutation handlers unchanged for status transitions.

## Todo List
- [x] Filter bar + saved views
- [x] Grouped board rendering
- [x] Virtualization integrated
- [x] Legacy behavior parity checked

## Success Criteria
- Users can find/track tasks quickly at high volume.
- Drag/drop + detail panel + comments remain stable.

## Risk Assessment
- Risk: virtualization breaks drag/drop or keyboard flows.
- Mitigation: fallback mode + targeted interaction tests.

## Security Considerations
- Avoid leaking hidden/archived tasks across unauthorized boards.
- Keep client-side filtering secondary to server-side access enforcement.

## Next Steps
- Add rollout guardrails, metrics, and canary controls.

---
phase: 5
title: "Board Detail Waterfall Removal and State Partitioning"
risk: HIGH
effort: 8h
status: completed
---

# Phase 05: Board Detail Waterfall Removal and State Partitioning

## Context Links
- [plan.md](./plan.md)
- [Board detail page](../../frontend/src/app/boards/[boardId]/page.tsx)
- [Task board component](../../frontend/src/components/organisms/TaskBoard.tsx)

## Overview
- Priority: P1
- Status: completed
- Refactor board detail route to remove sequential loads and reduce rerender blast radius.

## Key Insights
- Board detail is very large and holds many mutable states in a single component.
- Initial load still has sequential snapshot calls.

## Requirements
- Functional: keep task, comment, chat, approval flows unchanged.
- Non-functional: faster first usable render and smoother interactions.

## Architecture
- Parallelize independent initial requests.
- Partition state by feature module (tasks/comments/chat/approvals/live-feed).
- Keep SSE connections scoped to visible panels and active contexts.

## Related Code Files
- Modify: `frontend/src/app/boards/[boardId]/page.tsx`, `frontend/src/app/boards/[boardId]/*`, `frontend/src/lib/hooks/use-sse-stream.ts`
- Create: focused hooks under `frontend/src/lib/hooks/board-detail/`
- Delete: none

## Implementation Steps
1. Refactor initial load path with `Promise.allSettled`.
2. Extract feature states into dedicated hooks.
3. Normalize update flows from SSE to avoid whole-page state churn.
4. Keep SSR-safe dynamic loading for heavy side panels.

## Todo List
- [x] Remove sequential board snapshot waterfall
- [x] Split board state into feature hooks
- [x] Narrow rerender scope for task and chat updates
- [x] Validate board interactions end-to-end

## Success Criteria
- Faster board initial readiness.
- Reduced rerender volume during realtime updates.

## Risk Assessment
- Risk: regression in complex board interactions.
- Mitigation: incremental extraction + regression tests by feature.

## Security Considerations
- Preserve permission gates (`canWrite`, admin-only actions) after extraction.

## Next Steps
- Reuse extraction pattern for Activity feed rewrite in Phase 6.

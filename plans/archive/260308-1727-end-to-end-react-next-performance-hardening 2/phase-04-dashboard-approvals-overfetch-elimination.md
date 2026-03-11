---
phase: 4
title: "Dashboard and Approvals Overfetch Elimination"
risk: MEDIUM
effort: 4h
status: completed
---

# Phase 04: Dashboard and Approvals Overfetch Elimination

## Context Links
- [plan.md](./plan.md)
- [Dashboard page](../../frontend/src/app/dashboard/page.tsx)
- [Global approvals page](../../frontend/src/app/approvals/page.tsx)
- [Sidebar health polling](../../frontend/src/components/organisms/DashboardSidebar.tsx)

## Overview
- Priority: P1
- Status: completed
- Cut redundant polling and expensive N-per-board fanout in dashboard surfaces.

## Key Insights
- Dashboard currently runs multiple 15s/30s polls simultaneously.
- Approvals query fans out by board and can spike with board count.

## Requirements
- Functional: preserve operator visibility and approval response latency.
- Non-functional: reduce CPU/network pressure under high board cardinality.

## Architecture
- Shift to coarser aggregate endpoints where possible.
- Collapse duplicate query keys and remove no-store where not needed.
- Prefer incremental merge of realtime deltas over full list refetch.

## Related Code Files
- Modify: `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/approvals/page.tsx`, `frontend/src/components/organisms/DashboardSidebar.tsx`
- Create: none
- Delete: none

## Implementation Steps
1. Inventory each polling query and classify by freshness need.
2. Replace full-list intervals with lower-frequency or event-triggered refresh.
3. Cache/merge gateway and approvals data intelligently.
4. Validate dashboard perceived freshness with operator scenarios.

## Todo List
- [x] Reduce dashboard parallel polling load
- [x] De-duplicate approvals fanout refresh
- [x] Gate health polling by visibility/focus
- [x] Validate UX freshness manually

## Success Criteria
- Noticeable drop in request fanout on dashboard and approvals pages.
- Pending approval visibility remains near-realtime.

## Risk Assessment
- Risk: delayed display of critical updates.
- Mitigation: keep fallback manual refresh and SSE-based invalidation.

## Security Considerations
- Preserve per-board authorization checks during aggregation.

## Next Steps
- Apply same strategy to board-detail heavy flows in Phase 5.

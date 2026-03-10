---
phase: 6
title: "Activity Feed Progressive Loading Rewrite"
risk: HIGH
effort: 6h
status: completed
---

# Phase 06: Activity Feed Progressive Loading Rewrite

## Context Links
- [plan.md](./plan.md)
- [Activity page](../../frontend/src/app/activity/page.tsx)
- [Activity feed component](../../frontend/src/components/activity/ActivityFeed.tsx)

## Overview
- Priority: P1
- Status: completed
- Replace heavyweight initial seeding with progressive, parallel-first loading.

## Key Insights
- Current flow performs multiple expensive loops before first meaningful paint.
- Feed should prioritize fast first window then backfill.

## Requirements
- Functional: keep feed correctness and deep-link behavior.
- Non-functional: minimize initial blocking and maintain smooth scrolling.

## Architecture
- Two-stage load:
  - Stage A: minimal first page (boards + latest activity) in parallel.
  - Stage B: background enrichment (snapshots/chat/approvals) with dedupe.
- Preserve SSE for realtime continuation after initial stage.

## Related Code Files
- Modify: `frontend/src/app/activity/page.tsx`, related feed utilities/components
- Create: `frontend/src/lib/activity-feed-loader.ts` (optional orchestrator)
- Delete: none

## Implementation Steps
1. Build stage-based loader with cancellation and dedupe.
2. Render first window immediately, then enrich in background.
3. Ensure deep-link highlight works with late-arriving items.
4. Validate memory and CPU behavior under large org datasets.

## Todo List
- [x] Replace sequential loops with staged parallel loader
- [x] Keep deterministic dedupe and ordering logic
- [x] Preserve deep-link and highlight behavior
- [x] Validate with large board/event datasets

## Success Criteria
- Fast first feed render without waiting full dataset hydration.
- Realtime updates continue seamlessly after initial load.

## Risk Assessment
- Risk: ordering inconsistencies during background merges.
- Mitigation: canonical timestamp sorting + id-based dedupe contract.

## Security Considerations
- Ensure board-scoped visibility remains enforced when enriching data.

## Next Steps
- After data-flow rewrite, optimize payload and render path in Phases 7-8.

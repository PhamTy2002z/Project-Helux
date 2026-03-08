---
title: "React Performance Optimization"
description: "Safe, phased refactoring of Project-Helux frontend for bundle size, render perf, and maintainability"
status: pending
priority: P2
effort: 16h
branch: master
tags: [frontend, performance, refactoring]
created: 2026-03-08
---

# React Performance Optimization

## Phases

| # | Phase | Risk | Effort | Status |
|---|-------|------|--------|--------|
| 1 | [Quick wins: dynamic imports + memo](./phase-01-quick-wins.md) | LOW | 3h | pending |
| 2 | [Split boards/[boardId]/page.tsx](./phase-02-board-page-split.md) | MEDIUM | 6h | pending |
| 3 | [SSE logic consolidation](./phase-03-sse-consolidation.md) | MEDIUM | 4h | pending |
| 4 | [Fetch optimization](./phase-04-fetch-optimization.md) | LOW-MED | 3h | pending |

## Key Constraints
- ZERO breaking changes. Every refactor preserves exact behavior.
- Compile check after each file change.
- No functional changes -- structural optimization only.
- Phase 2 is highest risk; requires most careful review.

## Dependencies
- Phase 1: independent, can start immediately
- Phase 2: independent but benefits from Phase 1 patterns
- Phase 3: depends on Phase 2 (SSE hooks live inside board page)
- Phase 4: independent

## Success Criteria
- `pnpm build` passes after each phase
- All existing tests pass (`pnpm test`)
- No UI behavior changes (manual smoke test board page)
- Board page file < 500 LOC after Phase 2

---
title: "End-to-End React/Next Performance Hardening"
description: "Comprehensive plan to cut JS payload, remove waterfalls, and improve perceived speed across Mission Control frontend."
status: completed
priority: P1
effort: 44h
branch: master
tags: [frontend, performance, refactor, nextjs, react, critical]
created: 2026-03-08
---

# End-to-End React/Next Performance Hardening

## Overview
This plan fixes performance debt end-to-end: architecture boundaries, data fetching, realtime streams, bundle weight, render hot paths, and rollout guardrails.

## Context
- [scout-report.md](./reports/scout-report.md)
- [Previous partial plan](../260308-1423-react-performance-optimization/plan.md)
- [Code standards](../../docs/code-standards.md)

## Phases
| # | Phase | Risk | Effort | Status |
|---|-------|------|--------|--------|
| 1 | [Baseline + budgets + guardrails](./phase-01-baseline-budgets-guardrails.md) | LOW | 4h | completed |
| 2 | [Server/client boundary refactor](./phase-02-server-client-boundary-refactor.md) | HIGH | 7h | completed |
| 3 | [Query policy normalization](./phase-03-query-policy-normalization.md) | MEDIUM | 5h | completed |
| 4 | [Dashboard + approvals overfetch elimination](./phase-04-dashboard-approvals-overfetch-elimination.md) | MEDIUM | 4h | completed |
| 5 | [Board detail waterfall + state partitioning](./phase-05-board-detail-waterfall-state-partitioning.md) | HIGH | 8h | completed |
| 6 | [Activity feed progressive loading rewrite](./phase-06-activity-feed-progressive-loading-rewrite.md) | HIGH | 6h | completed |
| 7 | [Bundle splitting + heavy dependency isolation](./phase-07-bundle-splitting-heavy-dependency-isolation.md) | MEDIUM | 4h | completed |
| 8 | [Render hot-path optimization + virtualization](./phase-08-render-hot-path-optimization-virtualization.md) | MEDIUM | 4h | completed |
| 9 | [Verification, rollout, docs sync](./phase-09-verification-rollout-docs-sync.md) | LOW | 2h | completed |

## Dependency Chain
- Sequential: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
- Parallel allowance after Phase 3: Phase 4 and Phase 7 can overlap if owners do not touch same files.

## Success Criteria
- `pnpm build` and test suite pass after each phase.
- Significant reduction in initial JS for critical routes.
- Waterfall fetch paths replaced with parallel/progressive patterns.
- No behavior regression in auth, board operations, approvals, and feed interactions.
- Performance budgets and regression checks documented and enforced.

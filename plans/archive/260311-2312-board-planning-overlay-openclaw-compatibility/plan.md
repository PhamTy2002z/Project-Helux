---
title: "Board Planning Overlay (OpenClaw-Compatible)"
description: "Scale board UX with hierarchy, filters, and virtualization while preserving existing OpenClaw agent task contracts."
status: completed
priority: P1
effort: 56h
issue: null
branch: fix/ci-postgres-service
tags: [feature, frontend, backend, api, critical]
created: 2026-03-11
---

# Board Planning Overlay (OpenClaw-Compatible)

## Overview
Deliver scalable board UX (hierarchy + focus + fast navigation) without breaking current OpenClaw agent workflow, status gates, or task APIs.

## Phases
| # | Phase | Status | Effort | Link |
|---|---|---|---|---|
| 1 | Contract lock and guardrails | Completed | 6h | [phase-01](./phase-01-contract-lock-and-compatibility-guardrails.md) |
| 2 | Data model overlay | Completed | 8h | [phase-02-data-model-task-group-overlay-and-migration.md](./phase-02-data-model-task-group-overlay-and-migration.md) |
| 3 | API/query compatibility upgrades | Completed | 10h | [phase-03-task-query-and-snapshot-backward-compatible-upgrades.md](./phase-03-task-query-and-snapshot-backward-compatible-upgrades.md) |
| 4 | Agent workflow hardening | Completed | 8h | [phase-04-agent-workflow-template-and-intent-hardening.md](./phase-04-agent-workflow-template-and-intent-hardening.md) |
| 5 | Frontend scalable board UX | Completed | 12h | [phase-05-frontend-scalable-board-views-and-interactions.md](./phase-05-frontend-scalable-board-views-and-interactions.md) |
| 6 | Performance + rollout controls | Completed | 6h | [phase-06-performance-observability-and-rollout-control.md](./phase-06-performance-observability-and-rollout-control.md) |
| 7 | Regression + docs sync | Completed | 6h | [phase-07-regression-tests-and-documentation-sync.md](./phase-07-regression-tests-and-documentation-sync.md) |

## Compatibility Guardrails
- Preserve `TaskStatus` core enum and transitions (`inbox`, `in_progress`, `review`, `done`).
- Preserve agent discovery route semantics: `GET /api/v1/agent/boards/{board_id}/tasks`.
- Preserve task event taxonomy (`task.created`, `task.updated`, `task.status_changed`, `task.comment`).
- Additive changes only: new fields/endpoints/flags must not alter default behavior.

## Execution Strategy
- Backend-first additive schema and query capabilities.
- Agent contract tests before UI rollout.
- Feature flag for new board UX path, gradual enable per org/board.

## Dependencies
- Existing OpenClaw integration patterns in `docs/openclaw-specs.md`.
- Agent heartbeat/role templates in `backend/templates/BOARD_HEARTBEAT.md.j2`.
- Task workflow enforcement in `backend/app/api/tasks.py`.

## Success Metrics
- Agent heartbeat task loop parity: no behavioral regressions.
- Board interaction remains usable at 300+ tasks.
- Median filtered task query latency <= 250ms at target load.
- Time-to-find-target-task reduced by >= 50% in UX validation.

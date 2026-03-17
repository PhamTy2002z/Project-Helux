# Phase 06 - Performance Observability And Rollout Control

## Context Links
- `backend/app/api/metrics.py`
- `backend/app/services/activity_log.py`
- `frontend/src/lib/query-policy.ts`
- `compose.yml`

## Overview
- Priority: P2
- Status: Completed
- Scope: enforce safe rollout with measurable compatibility and performance signals.

## Key Insights
- UI scale work needs explicit canary and rollback criteria.
- Contract safety needs runtime telemetry, not only tests.

## Requirements
- Functional:
  1. Add feature flags for overlay endpoints/UI.
  2. Track query latency, filter usage, and agent loop parity metrics.
  3. Add canary rollout per org/board.
- Non-functional:
  1. Fast rollback path (< 5 minutes operationally).
  2. Alert on agent workflow regressions.

## Architecture
- Flags: `board_planning_overlay_v1`, `board_query_v2`.
- Metrics:
  - `board_query_latency_ms`
  - `board_overlay_enabled_count`
  - `agent_task_loop_regression_count`

## Related Code Files
- Modify:
  - `backend/app/api/metrics.py`
  - `backend/app/core/config.py`
  - `frontend/src/lib/query-policy.ts`
- Create:
  - `docs/operations/board-overlay-rollout-playbook.md`
- Delete:
  - none

## Implementation Steps
1. Add flags in backend/frontend config.
2. Instrument metrics/logging for new query and overlay usage.
3. Define SLOs and rollback triggers in playbook.

## Todo List
- [x] Flags wired
- [x] Metrics visible
- [x] Rollout playbook approved

## Success Criteria
- Canary boards stable before broad rollout.
- Immediate disable path verified.

## Risk Assessment
- Risk: silent regressions in non-canary orgs.
- Mitigation: default-off rollout + progressive cohorts.

## Security Considerations
- Feature flags not user-editable without admin privileges.
- Audit log for flag changes.

## Next Steps
- Final regression pass and documentation sync.

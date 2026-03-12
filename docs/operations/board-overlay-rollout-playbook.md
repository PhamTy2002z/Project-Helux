# Board overlay rollout playbook

Use this runbook to roll out the board planning overlay with fast rollback and
clear compatibility gates.

## Scope and goals

This playbook covers the feature flags, canary process, runtime telemetry, and
rollback steps for `board_planning_overlay_v1` and `board_query_v2`.

## Rollout flags

Set rollout flags in backend and frontend environments before deployment.

- Backend flags:
  - `BOARD_PLANNING_OVERLAY_V1`
  - `BOARD_PLANNING_OVERLAY_V1_CANARY_BOARD_IDS`
  - `BOARD_PLANNING_OVERLAY_V1_CANARY_ORG_IDS`
  - `BOARD_QUERY_V2`
  - `BOARD_QUERY_V2_CANARY_BOARD_IDS`
  - `BOARD_QUERY_V2_CANARY_ORG_IDS`
- Frontend flags:
  - `NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1`
  - `NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1_CANARY_BOARD_IDS`
  - `NEXT_PUBLIC_BOARD_PLANNING_OVERLAY_V1_CANARY_ORG_IDS`
  - `NEXT_PUBLIC_BOARD_QUERY_V2`
  - `NEXT_PUBLIC_BOARD_QUERY_V2_CANARY_BOARD_IDS`
  - `NEXT_PUBLIC_BOARD_QUERY_V2_CANARY_ORG_IDS`

## Canary rollout procedure

Run canary rollout in this order.

1. Enable only canary board IDs or organization IDs.
2. Deploy backend and frontend with default flags still disabled.
3. Validate canary boards manually for drag/drop, task updates, and comments.
4. Check metrics from `GET /api/v1/metrics/board-overlay` every 5 minutes.
5. Expand canary cohorts only after metrics remain stable for at least 30
   minutes.
6. Enable default flags only after all canary cohorts stay green.

## Observability and SLO gates

Use these operational gates before widening rollout.

- `board_query_latency_ms_p95 <= 250`
- `agent_task_loop_regression_count == 0`
- No increase in task update or comment-write API failures
- No unresolved board overlay UI regressions in canary boards

## Rollback

If any gate fails, run rollback immediately.

1. Disable default flags first (`BOARD_PLANNING_OVERLAY_V1=false`,
   `BOARD_QUERY_V2=false`).
2. Clear canary lists in backend and frontend environments.
3. Redeploy frontend and backend.
4. Verify `/api/v1/metrics/board-overlay` confirms zero enabled boards.
5. Confirm canary boards are back on legacy task board behavior.

## Verification checklist

Complete this checklist after each rollout wave.

- `make check` passes on the release commit.
- `GET /api/v1/metrics/board-overlay` returns expected enabled counts.
- No unresolved incidents in `docs/operations/incident-triage.md`.
- Support team is informed of current rollout cohort and rollback owner.

## Next steps

After full rollout, keep this playbook updated when new board overlay flags,
metrics, or compatibility tests are introduced.

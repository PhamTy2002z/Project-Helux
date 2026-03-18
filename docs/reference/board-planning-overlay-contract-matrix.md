# Board Planning Overlay Contract Matrix

Status: Active  
Owner: VisgniteAI backend/frontend maintainers  
Last updated: 2026-03-11

## Purpose
Lock non-negotiable OpenClaw compatibility while allowing additive board-planning overlay work.

## Immutable Contracts (Must Keep)
| Contract Area | Locked Behavior | Drift Detection |
|---|---|---|
| Task status model | `inbox -> in_progress -> review -> done` remains canonical. Existing gates still enforced. | `backend/tests/test_agent_task_contracts.py` |
| Agent task discovery route | `GET /api/v1/agent/boards/{board_id}/tasks` path and default semantics stay stable. | `backend/tests/test_agent_task_contracts.py` + OpenAPI tests |
| Task event taxonomy | `task.created`, `task.updated`, `task.status_changed`, `task.comment` stay unchanged. | `backend/tests/test_agent_task_contracts.py` |
| Heartbeat task comment protocol | Task progress updates remain task-comment-first, no chat spam workflow. | `backend/tests/test_agent_task_contracts.py`, template contract tests |

## Additive Changes Allowed
- New optional fields on `Task`: `task_group_id`, `sort_index`, `archived_at`.
- New optional planning model: `TaskGroup`.
- New optional filters for task list/query routes.
- New cursor pagination endpoint for scalable task reads.
- New guidance in templates/OpenAPI hints, only additive, no endpoint replacement.

## Explicitly Not Allowed
- Removing or renaming existing status values.
- Replacing `/api/v1/agent/boards/{board_id}/tasks` with a new default route.
- Renaming/removing task event types consumed by agent loops.
- Changing default write protocol from task comments to board chat for task execution.

## CI Gate Checklist
- [ ] Contract tests pass (`test_agent_task_contracts.py`).
- [ ] Heartbeat selection contract tests pass (`test_agent_heartbeat_task_selection_contract.py`).
- [ ] Task query compatibility tests pass (`test_task_query_scaling_contract.py`).
- [ ] Existing OpenAPI role-tag tests pass.
- [ ] Existing task workflow gate tests pass.

## Rollout Gate Checklist
- [ ] Overlay fields deployed with additive migration only.
- [ ] Old clients run without sending any new query params.
- [ ] Agent loop behavior unchanged for boards not using task groups.
- [ ] Filter/cursor path enabled for UI without changing default agent route usage.

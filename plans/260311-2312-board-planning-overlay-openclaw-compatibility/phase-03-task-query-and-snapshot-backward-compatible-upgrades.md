# Phase 03 - Task Query And Snapshot Backward Compatible Upgrades

## Context Links
- `backend/app/api/tasks.py`
- `backend/app/api/agent.py`
- `backend/app/services/board_snapshot.py`
- `backend/app/services/board_group_snapshot.py`

## Overview
- Priority: P1
- Status: Completed
- Scope: scalable filters and pagination for UI while preserving existing defaults.

## Key Insights
- Current list API has limited filters and created_at ordering only.
- Snapshot loads full task list; this becomes bottleneck at high volume.

## Requirements
- Functional:
  1. Add optional filters: `q`, `tag_ids`, `priority`, `blocked`, `due_before/after`, `has_pending_approval`, `task_group_id`, `archived`.
  2. Add cursor-based query endpoint for board UI scale path.
  3. Keep old list endpoint response/behavior default-compatible.
- Non-functional:
  1. P95 task query target <= 250ms at expected load.
  2. No agent endpoint default semantic change.

## Architecture
- Keep `/api/v1/agent/boards/{board_id}/tasks` unchanged by default.
- Add scalable read model endpoint for UI (cursor + select fields).
- Snapshot endpoint can expose optional compact mode flag; default remains existing shape.

## Related Code Files
- Modify:
  - `backend/app/api/tasks.py`
  - `backend/app/api/agent.py`
  - `backend/app/services/board_snapshot.py`
  - `backend/app/schemas/view_models.py`
- Create:
  - `backend/app/schemas/task_queries.py`
  - `backend/tests/test_task_query_scaling_contract.py`
- Delete:
  - none

## Implementation Steps
1. Extend `_task_list_statement` with optional filters (opt-in only).
2. Add query DTOs and validation for filters/sorts.
3. Implement cursor endpoint + index-aware ordering.
4. Add regression tests: old route parity, new route functionality/perf.

## Todo List
- [x] New filters implemented
- [x] Cursor endpoint available
- [x] Compatibility tests passing

## Success Criteria
- Agent route behavior parity proven by tests.
- UI can query focused subsets efficiently.

## Risk Assessment
- Risk: filter complexity introduces slow SQL plans.
- Mitigation: explicit index strategy + EXPLAIN checks in test env.

## Security Considerations
- Enforce board access in every new query route.
- Input-validate search/filter params to avoid abusive payloads.

## Next Steps
- Align agent templates and intent guidance with new optional filters.

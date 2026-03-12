# Phase 02 - Data Model Task Group Overlay And Migration

## Context Links
- `backend/app/models/tasks.py`
- `backend/app/models/boards.py`
- `backend/migrations/versions/`
- `backend/app/schemas/tasks.py`

## Overview
- Priority: P1
- Status: Completed
- Scope: add planning overlay model without changing task execution contract.

## Key Insights
- Parent/subtask in core task status would risk agent regressions.
- Separate `TaskGroup` gives hierarchy without changing actionable task semantics.

## Requirements
- Functional:
  1. Add `task_groups` model (board-scoped planning container).
  2. Add nullable `task_group_id`, `sort_index`, `archived_at` to `tasks`.
- Non-functional:
  1. Migration backward-compatible.
  2. No rewrite of existing rows required for baseline behavior.

## Architecture
- New model: `TaskGroup(id, board_id, title, description, rank, collapsed_default, created_at, updated_at)`.
- Existing `Task` remains execution unit; grouping optional.
- `archived_at` enables done compression/archive views.

## Related Code Files
- Modify:
  - `backend/app/models/tasks.py`
  - `backend/app/schemas/tasks.py`
  - `backend/app/db/base.py` (if import registry needed)
- Create:
  - `backend/app/models/task_groups.py`
  - `backend/app/schemas/task_groups.py`
  - `backend/migrations/versions/<ts>_add_task_groups_overlay.py`
- Delete:
  - none

## Implementation Steps
1. Define model + FK indexes (`board_id`, `task_group_id`, `archived_at`).
2. Generate migration with safe defaults and nullability.
3. Extend task read/create/update schemas additively.
4. Validate alembic upgrade/downgrade and existing API payload compatibility.

## Todo List
- [x] Model + schema merged
- [x] Migration tested locally
- [x] No response-schema break in existing endpoints

## Success Criteria
- Existing task flows unchanged with null group fields.
- New fields available for advanced query/UI.

## Risk Assessment
- Risk: migration lock time on large task table.
- Mitigation: additive columns only, indexed in controlled steps.

## Security Considerations
- Keep board/org scoping invariants on new model relations.
- Validate group ownership in write paths.

## Next Steps
- Extend task query layer and snapshot payloads in phase 03.

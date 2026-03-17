# Phase 07 - Regression Tests And Documentation Sync

## Context Links
- `backend/tests/`
- `frontend/src/components/organisms/TaskBoard.test.tsx`
- `docs/project-changelog.md`
- `docs/project-roadmap.md`
- `docs/system-architecture.md`
- `docs/code-standards.md`

## Overview
- Priority: P1
- Status: Completed
- Scope: verify no contract break and finalize docs for maintainability.

## Key Insights
- Agent compatibility is the acceptance gate, not optional QA.
- Docs must capture new overlay architecture and migration path.

## Requirements
- Functional:
  1. Add regression suite for agent endpoints/template assumptions.
  2. Add frontend interaction tests for grouped board behavior.
  3. Update roadmap/changelog/architecture docs.
- Non-functional:
  1. CI quality gates aligned with rollout plan.
  2. No unresolved compatibility gaps.

## Architecture
- Test matrix:
  1. API compatibility
  2. Agent heartbeat loop parity
  3. UI behavior under large datasets
  4. Rollback path verification

## Related Code Files
- Modify:
  - `backend/tests/test_agent_api.py`
  - `backend/tests/test_tasks_api.py`
  - `frontend/src/components/organisms/TaskBoard.test.tsx`
  - `docs/project-changelog.md`
  - `docs/project-roadmap.md`
  - `docs/system-architecture.md`
  - `docs/code-standards.md`
- Create:
  - `backend/tests/test_board_overlay_compatibility.py`
  - `frontend/src/components/organisms/task-board-overlay.test.tsx`
- Delete:
  - none

## Implementation Steps
1. Build regression test matrix and automate in CI.
2. Run full check (`make check`) on feature branch.
3. Update docs with architecture/rollout/compat notes.
4. Final go/no-go review against contract matrix.

## Todo List
- [x] Regression tests implemented
- [x] CI full pass
- [x] Docs updated and cross-linked
- [x] Go-live checklist signed off

## Success Criteria
- All tests pass with overlay flag on/off.
- Documentation accurately reflects real implementation.

## Risk Assessment
- Risk: test coverage misses template-prompt drift.
- Mitigation: snapshot tests for critical template sections.

## Security Considerations
- Ensure docs do not include secrets/tokens.
- Verify no auth bypass in new query endpoints.

## Next Steps
- Start implementation with cook handoff using this plan.

# Phase 6: Tests, Regression, and Docs Sync

## Context Links

- Plan overview: [plan.md](./plan.md)
- Backend tests dir: `backend/tests/`
- Frontend tests dir: `frontend/src/**/*.test.tsx`
- Documentation set: `docs/project-roadmap.md`, `docs/system-architecture.md`, `docs/code-standards.md`

## Overview

- **Priority:** P1
- **Status:** Completed
- **Description:** Lock quality with tests and align project documentation after implementation.

## Key Insights

- Multi-session chat touches schema, API contracts, and interactive UX.
- Regression risk highest in SSE merge, command flows (`/pause`, `/resume`), and permission gating.
- Docs updates required by project protocol when major feature lands.

## Requirements

Functional:

- Add/update backend API tests for session CRUD and memory filters.
- Verify delete endpoint is soft-delete archive behavior.
- Verify auto-title rule only runs for untouched `New chat` titles.
- Add/update frontend tests for session interactions and scroll behavior.
- Update roadmap/changelog/architecture notes to reflect delivered feature.

Non-functional:

- Keep CI-equivalent checks passing.
- Ensure no flaky test additions.

## Architecture

Validation matrix:

1. Backend unit/integration tests for schema + API semantics.
2. Frontend component tests for chat panel state transitions.
3. Manual smoke for desktop/mobile interaction ergonomics.

## Related Code Files

Modify:

- `backend/tests/test_*chat*`
- `frontend/src/components/**/*chat*.test.tsx`
- `docs/project-roadmap.md`
- `docs/system-architecture.md`
- `docs/code-standards.md` (if pattern guidance changes)
- `docs/project-changelog.md` (if present by implementation time)

Create:

- Targeted new test files where gaps exist.

Delete:

- None.

## Implementation Steps

1. Write backend tests for session CRUD + memory filtering + validation.
2. Add backend tests for archive-delete and auto-title behavior.
3. Write frontend tests for create/rename/delete (archive-hide) and session switching.
4. Validate no regression in `/pause` `/resume` global flows.
5. Run `make check` or scoped equivalents.
6. Update docs with actual delivered behavior and constraints.

## Todo List

- [x] Backend tests added and passing.
- [x] Frontend tests added and passing.
- [x] Archive-delete and auto-title rules covered by tests.
- [x] Regression checks done for command flow and SSE duplication.
- [x] Docs updated per project documentation protocol.

## Success Criteria

- CI checks green for modified scope.
- Feature behavior stable across main user journeys.
- Docs and roadmap reflect real implementation status.

## Risk Assessment

- Risk: flaky frontend timing tests for scroll behavior.
- Mitigation: test deterministic conditions; keep e2e/manual verification for animation-sensitive cases.

## Security Considerations

- Validate permission matrix for session mutation endpoints.
- Confirm no tenant/board access leakage in list or stream filters.

## Next Steps

- Ready for implementation handoff.

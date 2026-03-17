# Phase 6: Tests and Rollout

## Context Links
- [Phase 1-5 plan files](plan.md)
- [Backend test structure](../../backend/tests/)
- [Frontend test structure](../../frontend/src/components/agents/AgentsTable.test.tsx)
- [Code standards: testing](../../docs/code-standards.md)

## Overview
- **Priority**: P2
- **Status**: complete
- **Effort**: 2h
- **Progress**: 100%

Write backend API tests, frontend component tests, verify end-to-end flow, update docs.

## Key Insights
- Backend tests follow `tests/api/test_*.py` pattern with `httpx.AsyncClient`.
- Frontend tests use Vitest + React Testing Library.
- E2E coverage deferred to existing Cypress suite (manual verification sufficient for MVP).

## Requirements
- Functional:
  - Backend: CRUD endpoints tested (happy path + error cases).
  - Backend: template provisioning tested (mock gateway write).
  - Frontend: template picker rendering + selection tested.
- Non-functional:
  - No flaky tests; mock external dependencies (gateway RPC).
  - Coverage targets: 80% backend, 70% frontend for new code.

## Implementation Steps

### Backend Tests

1. Create `backend/tests/api/test_workspace_templates.py`:
   ```python
   # Test cases:
   # - list_templates_returns_system_and_org_templates
   # - list_templates_filters_by_category
   # - get_template_returns_200
   # - get_template_not_found_returns_404
   # - create_template_valid_returns_201
   # - create_template_invalid_file_keys_returns_422
   # - create_template_exceeds_char_limit_returns_422
   # - create_template_with_env_var_pattern_returns_422
   # - update_system_template_returns_403
   # - delete_system_template_returns_403
   # - update_org_template_returns_200
   # - delete_org_template_returns_200
   # - cross_org_template_not_accessible
   ```

2. Create `backend/tests/services/test_workspace_template_writer.py`:
   ```python
   # Test cases:
   # - render_template_content_replaces_variables
   # - render_template_content_no_variables_unchanged
   # - render_template_content_missing_variable_left_as_is
   ```

3. Create `backend/tests/api/test_agents_with_template.py`:
   ```python
   # Test cases:
   # - create_agent_with_template_id_stores_reference
   # - create_agent_with_template_defaults_name
   # - create_agent_without_template_unchanged
   # - create_agent_invalid_template_returns_404
   # - create_agent_inaccessible_template_returns_403
   # - agent_read_includes_template_id
   ```

### Frontend Tests

4. Create `frontend/src/components/agents/template-card.test.tsx`:
   ```typescript
   // - renders template name and description
   // - shows selected state when selected
   // - calls onSelect on click
   ```

5. Create `frontend/src/components/agents/agent-create-dialog.test.tsx`:
   ```typescript
   // - renders template picker step initially
   // - transitions to customize step on template select
   // - submits with template_id and name
   // - skip template link works
   ```

### Docs Update

6. Update `docs/system-architecture.md`:
   - Add `workspace_templates` to DB schema overview.
   - Add template provisioning to Gateway Communication Flow.

7. Update `docs/project-changelog.md`:
   - Add workspace templates feature entry.

### Rollout Verification

8. Manual verification checklist:
   - [ ] Fresh DB: 12 seed templates appear after migration + startup.
   - [ ] Create agent from "Developer" template: workspace files written.
   - [ ] Create agent from "Blank - Professional": minimal workspace files written.
   - [ ] Create agent without template: existing behavior preserved.
   - [ ] Template picker UI loads, filters, searches correctly.
   - [ ] Agent detail shows `template_id` in response.

## Related Code Files

### Files to create:
- `backend/tests/api/test_workspace_templates.py`
- `backend/tests/services/test_workspace_template_writer.py`
- `backend/tests/api/test_agents_with_template.py`
- `frontend/src/components/agents/template-card.test.tsx`
- `frontend/src/components/agents/agent-create-dialog.test.tsx`

### Files to modify:
- `docs/system-architecture.md` — add workspace_templates to schema overview.
- `docs/project-changelog.md` — add feature entry.

### Files to delete:
- None.

## Todo List
- [x] Backend CRUD tests written and passing.
- [x] Backend template writer unit tests passing.
- [x] Backend agent+template integration tests passing.
- [x] Frontend template card tests passing.
- [x] Frontend dialog tests passing.
- [x] Docs updated (system-architecture, changelog).
- [x] Manual rollout verification complete.
- [x] `pnpm build` passes (frontend).
- [x] `alembic upgrade head` clean on fresh DB.

## Success Criteria
- All new tests green.
- No existing tests broken.
- Lint passes (`ruff check`, `pnpm lint`).
- Frontend build passes.
- Manual verification checklist complete.

## Risk Assessment
- Low: standard test patterns, no new infrastructure.
- Gateway mock: reuse existing test fixtures for gateway RPC mocking.

# Phase 4: Agent Creation Flow Integration

## Context Links
- [Phase 2: CRUD API](phase-02-backend-crud-api-and-seed-data.md)
- [Phase 3: Provisioning](phase-03-template-provisioning-service.md)
- [Agent API](../../backend/app/api/agents.py)
- [Agent schemas](../../backend/app/schemas/agents.py)
- [Provisioning DB](../../backend/app/services/openclaw/provisioning_db.py)

## Overview
- **Priority**: P1
- **Status**: complete
- **Effort**: 3h
- **Progress**: 100%

Wire `template_id` through the existing agent creation API. When user creates agent with a template, the provisioning pipeline applies template workspace files.

## Key Insights
- `AgentCreate` schema already has `identity_template` and `soul_template` fields. `template_id` is a NEW field that triggers workspace-level provisioning.
- If `template_id` is set, `identity_template` and `soul_template` fields are IGNORED (template takes precedence).
- Existing `AgentLifecycleService.create_agent()` is the single entry point; modification is surgical.
- `AgentRead` should expose `template_id` so frontend knows which template was used.

## Requirements
- Functional:
  - `POST /api/v1/agents` accepts optional `template_id` field.
  - When `template_id` provided: validate template exists and is accessible to org, provision from template.
  - When `template_id` absent: existing flow unchanged.
  - `GET /api/v1/agents` and `GET /api/v1/agents/{id}` return `template_id` in response.
  - Agent name auto-populated from template name if not explicitly provided.
- Non-functional:
  - Backward compatible: no breaking changes to existing agent creation.
  - Template validation is fast (single DB lookup).

## Architecture

### Updated Agent Create Flow

```
POST /api/v1/agents
{
  "name": "My Support Bot",      // optional if template_id set
  "board_id": "...",
  "template_id": "..."           // NEW optional field
}
    |
    v
AgentCreate schema validation
    |
    +-- If template_id: validate template exists + org access
    +-- If no name but template_id: use template.name as default
    |
    v
AgentLifecycleService.create_agent()
    |
    +-- Fetch template file_contents (if template_id)
    +-- Pass to provisioner (phase 3)
    +-- Store template_id on agent record
    |
    v
Return AgentRead (includes template_id)
```

### Schema Changes

```python
# AgentCreate (add field)
template_id: UUID | None = Field(
    default=None,
    description="Workspace template to apply. Overrides identity_template/soul_template."
)

# AgentRead (add field)
template_id: UUID | None = Field(
    default=None,
    description="Workspace template applied to this agent."
)
```

## Related Code Files

### Files to modify:
- `backend/app/schemas/agents.py` — add `template_id` to `AgentCreate`, `AgentRead`.
- `backend/app/api/agents.py` — pass `template_id` through to service.
- `backend/app/services/openclaw/provisioning_db.py` — template lookup + provisioning branch in `create_agent()`.

### Files to create:
- None (all changes in existing files).

### Files to delete:
- None.

## Implementation Steps

1. Add `template_id` to `AgentCreate` and `AgentRead` schemas in `backend/app/schemas/agents.py`.

2. In `backend/app/api/agents.py` create-agent endpoint:
   - Extract `template_id` from payload.
   - If `template_id` set, validate template exists and is accessible:
     ```python
     template = await session.get(WorkspaceTemplate, payload.template_id)
     if not template:
         raise HTTPException(404, "Template not found")
     if template.organization_id and template.organization_id != ctx.organization_id:
         raise HTTPException(403, "Template not accessible")
     ```
   - If no `name` provided but `template_id` set, default name to `template.name`.

3. In `provisioning_db.py` `AgentLifecycleService.create_agent()`:
   - Accept `template_file_contents` parameter.
   - Pass through to provisioner call.
   - Set `agent.template_id` before commit.

4. Regenerate Orval API client:
   ```bash
   cd frontend && pnpm orval
   ```

5. Verify backward compatibility: existing agent creation (no `template_id`) unchanged.

## Todo List
- [x] `template_id` added to `AgentCreate` and `AgentRead`.
- [x] API endpoint validates template access.
- [x] Service layer passes template content to provisioner.
- [x] Default name from template when name omitted.
- [x] Backward compat verified (no template_id = existing behavior).
- [x] Orval client regenerated.

## Success Criteria
- `POST /agents` with `template_id` creates agent with workspace files from template.
- `POST /agents` without `template_id` works exactly as before.
- `GET /agents/{id}` returns `template_id` field.
- Invalid `template_id` returns 404; inaccessible template returns 403.

## Risk Assessment
- Low: surgical changes to existing flow.
- Name defaulting from template could conflict with existing agents on board; handle with suffix if needed.

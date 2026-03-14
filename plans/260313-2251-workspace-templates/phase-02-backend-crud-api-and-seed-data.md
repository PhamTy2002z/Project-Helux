# Phase 2: Backend CRUD API and Seed Data

## Context Links
- [Phase 1: DB schema](phase-01-db-schema-and-model.md)
- [Skills marketplace API pattern](../../backend/app/api/skills_marketplace.py)
- [Skills marketplace schemas](../../backend/app/schemas/skills_marketplace.py)
- [Agents schemas](../../backend/app/schemas/agents.py)
- [Provisioning constants](../../backend/app/services/openclaw/constants.py)

## Overview
- **Priority**: P1
- **Status**: complete
- **Effort**: 4h
- **Progress**: 100%

Build CRUD endpoints for workspace templates + seed 12 MVP templates via migration or startup script.

## Key Insights
- Follow `skills_marketplace.py` pattern: org-scoped CRUD with admin auth.
- System templates (seed) are read-only from API; org templates are full CRUD.
- Template content validation at schema layer: known file keys, char limits.
- Seed templates embedded in code (not external files) for portability.

## Requirements
- Functional:
  - `GET /api/v1/workspace-templates` — list templates (system + org).
  - `GET /api/v1/workspace-templates/{id}` — get single template.
  - `POST /api/v1/workspace-templates` — create org template (admin only).
  - `PATCH /api/v1/workspace-templates/{id}` — update org template (admin only).
  - `DELETE /api/v1/workspace-templates/{id}` — delete org template (admin only).
  - Seed 12 system templates on first startup or via migration.
- Non-functional:
  - System templates cannot be modified/deleted via API.
  - Pagination via `DefaultLimitOffsetPage`.
  - Category filter on list endpoint.

## Architecture

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/workspace-templates` | org_admin | List system + org templates |
| GET | `/api/v1/workspace-templates/{id}` | org_admin | Get template by ID |
| POST | `/api/v1/workspace-templates` | org_admin | Create custom template |
| PATCH | `/api/v1/workspace-templates/{id}` | org_admin | Update custom template |
| DELETE | `/api/v1/workspace-templates/{id}` | org_admin | Delete custom template |

### Schemas

```python
# workspace_templates.py (schemas)

ALLOWED_FILE_KEYS = {"AGENTS.md", "SOUL.md", "IDENTITY.md", "TOOLS.md"}
MAX_FILE_CHARS = 20_000
MAX_TOTAL_CHARS = 150_000

class WorkspaceTemplateBase(SQLModel):
    name: NonEmptyStr
    description: str | None = None
    category: str | None = None
    icon: str | None = None
    file_contents: dict[str, str]  # validated keys + char limits

class WorkspaceTemplateCreate(WorkspaceTemplateBase):
    pass

class WorkspaceTemplateUpdate(SQLModel):
    name: NonEmptyStr | None = None
    description: str | None = None
    category: str | None = None
    icon: str | None = None
    file_contents: dict[str, str] | None = None

class WorkspaceTemplateRead(WorkspaceTemplateBase):
    id: UUID
    slug: str
    organization_id: UUID | None
    is_system: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
```

### Validation Rules (field_validator on file_contents)
1. Keys must be in `ALLOWED_FILE_KEYS`.
2. Each value <= 20,000 chars.
3. Total chars across all values <= 150,000.
4. At least `AGENTS.md` key required.
5. No `${...}` env var references (security: no secret injection via templates).

### Seed Templates (12 MVP)

| # | Name | Slug | Category | Icon |
|---|------|------|----------|------|
| 1 | Personal Assistant | personal-assistant | general | sparkles |
| 2 | Customer Support Bot | customer-support-bot | support | headset |
| 3 | Developer | developer | development | code |
| 4 | Code Reviewer | code-reviewer | development | search |
| 5 | QA/QC Tester | qa-qc-tester | development | check-circle |
| 6 | Business Analyst | business-analyst | business | bar-chart |
| 7 | Content Writer | content-writer | content | pencil |
| 8 | Research Assistant | research-assistant | research | book-open |
| 9 | Data Analyst | data-analyst | data | database |
| 10 | Email Drafter | email-drafter | content | mail |
| 11 | Blank - Professional | blank-professional | blank | briefcase |
| 12 | Blank - Casual | blank-casual | blank | smile |

Each seed template has `AGENTS.md`, `SOUL.md`, `IDENTITY.md` with role-appropriate content. `TOOLS.md` optional per template.

## Related Code Files

### Files to create:
- `backend/app/schemas/workspace_templates.py`
- `backend/app/api/workspace_templates.py`
- `backend/app/services/workspace_templates.py`
- `backend/app/services/workspace_template_seeds.py` — seed template content definitions.

### Files to modify:
- `backend/app/api/__init__.py` — register router.
- `backend/app/schemas/agents.py` — add `template_id` to `AgentCreate` and `AgentRead`.

### Files to delete:
- None.

## Implementation Steps

1. Create Pydantic schemas in `backend/app/schemas/workspace_templates.py`:
   - `WorkspaceTemplateCreate`, `WorkspaceTemplateUpdate`, `WorkspaceTemplateRead`.
   - `file_contents` validator: key allowlist, char limits, required `AGENTS.md`.

2. Create service in `backend/app/services/workspace_templates.py`:
   - `list_templates(session, org_id, category?)` — system + org-scoped query.
   - `get_template(session, template_id)` — single fetch.
   - `create_template(session, org_id, user_id, payload)` — slug auto-gen, duplicate check.
   - `update_template(session, template_id, payload)` — reject if `is_system`.
   - `delete_template(session, template_id)` — reject if `is_system`.

3. Create API routes in `backend/app/api/workspace_templates.py`:
   - Standard CRUD pattern following `skills_marketplace.py`.
   - Auth: `require_org_admin` dependency.

4. Register router in `backend/app/api/__init__.py`.

5. Create seed data in `backend/app/services/workspace_template_seeds.py`:
   - Dict of 12 templates with `file_contents` for each.
   - `ensure_seed_templates(session)` function — upsert system templates on startup.
   - Called from app startup hook or first-run bootstrap.

6. Add `template_id` to `AgentCreate` and `AgentRead` schemas:
   ```python
   template_id: UUID | None = Field(default=None, description="Workspace template applied to this agent.")
   ```

7. Run Orval to regenerate frontend API client after OpenAPI spec updates.

## Todo List
- [x] Schemas created with validators.
- [x] Service layer CRUD implemented.
- [x] API routes registered and functional.
- [x] 12 seed templates defined (10 role-based + 2 blank).
- [x] Seed upsert function created and hooked into startup.
- [x] `template_id` added to agent schemas.
- [x] OpenAPI spec verified (Swagger UI check).

## Success Criteria
- All 5 CRUD endpoints return correct responses.
- System templates appear in list for any org.
- System templates cannot be modified/deleted (403).
- Invalid `file_contents` rejected with clear error messages.
- 12 seed templates available after fresh startup.

## Risk Assessment
- Seed content quality: templates should be useful out-of-box. Iterate content post-MVP.
- Slug collision: handle gracefully with counter suffix (`developer-2`).

## Security Considerations
- `file_contents` validated: no `${...}` env var patterns allowed.
- Org isolation: org templates only visible to their own org + system templates.
- No secrets in template content; enforced via validator.

# Phase 1: DB Schema and Model

## Context Links
- [Research deep dive](../reports/researcher-260313-2228-workspace-templates-deep-dive.md)
- [Agent model](../../backend/app/models/agents.py)
- [Skills model](../../backend/app/models/skills.py)
- [Base model](../../backend/app/models/base.py)
- [Model registry](../../backend/app/models/__init__.py)

## Overview
- **Priority**: P1 (hard blocker)
- **Status**: complete
- **Effort**: 3h
- **Progress**: 100%

Create `workspace_templates` table and SQLModel entity. Add `template_id` FK to `agents` table.

## Key Insights
- Agent model already has `identity_template` and `soul_template` text fields; workspace templates is a higher-level concept storing full workspace file bundles.
- Follow `MarketplaceSkill` pattern for org-scoped templates with `is_system` flag for seed templates.
- JSONB column stores file contents as `{"AGENTS.md": "...", "SOUL.md": "...", "IDENTITY.md": "..."}`.
- Keep it simple: no versioning, no fork/clone in MVP.

## Requirements
- Functional:
  - `workspace_templates` table with org scope + system flag.
  - `agents.template_id` nullable FK for tracking which template was applied.
  - Unique constraint on `(organization_id, slug)` for org templates; system templates have `organization_id=NULL`.
- Non-functional:
  - Additive migration only.
  - JSONB indexed for future full-text search on template content.

## Architecture

### DB Schema

```sql
CREATE TABLE workspace_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),  -- NULL for system templates
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),        -- e.g. "development", "support", "content"
    icon            VARCHAR(50),         -- emoji or icon key, e.g. "wrench" or "headset"
    file_contents   JSONB NOT NULL,      -- {"AGENTS.md": "...", "SOUL.md": "...", ...}
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_templates_org_slug UNIQUE (organization_id, slug)
);

CREATE INDEX ix_workspace_templates_org_id ON workspace_templates(organization_id);
CREATE INDEX ix_workspace_templates_category ON workspace_templates(category);
CREATE INDEX ix_workspace_templates_is_system ON workspace_templates(is_system);

-- Add template_id to agents
ALTER TABLE agents ADD COLUMN template_id UUID REFERENCES workspace_templates(id);
CREATE INDEX ix_agents_template_id ON agents(template_id);
```

### Key Design Choices
- `organization_id = NULL` + `is_system = TRUE` for seed templates (visible to all orgs).
- `organization_id = X` for org-created custom templates.
- `file_contents` JSONB validated at app layer: keys must be known filenames, values <= 20K chars each.
- `slug` auto-generated from `name` via `slugify()` (already exists in codebase).

## Related Code Files

### Files to create:
- `backend/app/models/workspace_templates.py`
- `backend/migrations/versions/{next}_add_workspace_templates.py`

### Files to modify:
- `backend/app/models/__init__.py` — register `WorkspaceTemplate`.
- `backend/app/models/agents.py` — add `template_id` field.

### Files to delete:
- None.

## Implementation Steps

1. Create `WorkspaceTemplate` SQLModel entity in `backend/app/models/workspace_templates.py`:
   - UUID PK, `organization_id` (nullable FK), `name`, `slug`, `description`, `category`, `icon`, `file_contents` (JSONB), `is_system`, `created_by`, timestamps.
   - UniqueConstraint on `(organization_id, slug)`.
   - Indexes on `organization_id`, `category`, `is_system`.

2. Add `template_id` nullable UUID FK to `Agent` model:
   ```python
   template_id: UUID | None = Field(default=None, foreign_key="workspace_templates.id", index=True)
   ```

3. Register in `backend/app/models/__init__.py`:
   ```python
   from app.models.workspace_templates import WorkspaceTemplate
   ```

4. Generate Alembic migration:
   ```bash
   cd backend && alembic revision --autogenerate -m "add workspace_templates table and agents.template_id"
   ```

5. Verify migration up/down:
   ```bash
   alembic upgrade head && alembic downgrade -1 && alembic upgrade head
   ```

## Todo List
- [x] `WorkspaceTemplate` SQLModel entity created.
- [x] `agents.template_id` FK added.
- [x] Model registered in `__init__.py`.
- [x] Alembic migration generated and tested.
- [x] Migration up/down verified locally.

## Success Criteria
- `workspace_templates` table exists with correct schema.
- `agents.template_id` column exists and references `workspace_templates.id`.
- No existing tests broken.

## Risk Assessment
- Low risk: additive schema only, no breaking changes.
- `organization_id` nullable means system templates need careful query handling (`WHERE organization_id IS NULL AND is_system = TRUE`).

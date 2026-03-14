# Phase 3: Template Provisioning Service

## Context Links
- [Phase 1: DB schema](phase-01-db-schema-and-model.md)
- [Phase 2: CRUD API](phase-02-backend-crud-api-and-seed-data.md)
- [Provisioning service](../../backend/app/services/openclaw/provisioning.py)
- [Provisioning DB layer](../../backend/app/services/openclaw/provisioning_db.py)
- [Gateway RPC](../../backend/app/services/openclaw/gateway_rpc.py)
- [Constants](../../backend/app/services/openclaw/constants.py)
- [Research: provisioning methods](../reports/researcher-260313-2228-workspace-templates-deep-dive.md)

## Overview
- **Priority**: P1
- **Status**: complete
- **Effort**: 4h
- **Progress**: 100%

Integrate template file-write into existing gateway provisioning pipeline. When agent created with `template_id`, write workspace files to gateway filesystem.

## Key Insights
- Existing `OpenClawGatewayProvisioner` already writes workspace files (AGENTS.md, SOUL.md, etc.) during agent provisioning via Jinja2 templates.
- Current flow: `provisioning.py` renders templates from `constants.py` maps (`MAIN_TEMPLATE_MAP`, `LEAD_TEMPLATE_MAP`).
- Workspace templates feature REPLACES the default template rendering with user-selected template content from DB.
- No new transport needed: reuse existing file-write mechanism in provisioner.
- Key distinction: existing templates are Jinja2-rendered with agent context; workspace templates are stored as-is (raw markdown).

## Requirements
- Functional:
  - When `template_id` is set on agent creation, fetch template `file_contents` from DB.
  - Write each file key to gateway workspace path (e.g., `AGENTS.md` -> `~/.openclaw/workspace/AGENTS.md`).
  - Fall back to existing default templates when `template_id` is NULL (backward compat).
  - Support variable substitution in template content: `{{agent_name}}`, `{{board_name}}`, `{{org_name}}`.
- Non-functional:
  - File write is idempotent (overwrite existing files).
  - Error on file write logged but does not block agent creation (agent still usable with defaults).
  - No gateway restart triggered (workspace files load on session start).

## Architecture

### Provisioning Flow (Updated)

```
Agent Create Request (with template_id)
    |
    v
AgentLifecycleService.create_agent()
    |
    +-- Fetch WorkspaceTemplate from DB
    |
    +-- Call OpenClawGatewayProvisioner.provision_agent()
    |       |
    |       +-- IF template_id exists:
    |       |     - Render template file_contents with basic variable substitution
    |       |     - Write each file to workspace path
    |       |
    |       +-- ELSE (no template):
    |       |     - Use existing Jinja2 default templates (current behavior)
    |       |
    |       +-- Write openclaw.json config if needed
    |
    +-- Store template_id on Agent record
    |
    v
Agent record created (status: provisioning)
```

### Variable Substitution
Simple `str.replace` on template content before writing:

| Variable | Value Source |
|----------|-------------|
| `{{agent_name}}` | `agent.name` |
| `{{board_name}}` | `board.name` |
| `{{org_name}}` | `organization.name` |
| `{{date}}` | current date ISO |

No Jinja2 for user templates (security: prevent template injection). Just literal string replacement.

### Workspace Path Resolution
- Single-agent mode: `{gateway.workspace_root}/workspace/`
- Multi-agent mode (future): `{gateway.workspace_root}/workspace-{agent_key}/`
- MVP: single-agent mode only.

## Related Code Files

### Files to create:
- `backend/app/services/openclaw/workspace_template_writer.py` — template content rendering + file write logic.

### Files to modify:
- `backend/app/services/openclaw/provisioning.py` — add template-aware branch in workspace file write.
- `backend/app/services/openclaw/provisioning_db.py` — fetch template in create_agent flow, pass to provisioner.
- `backend/app/services/openclaw/constants.py` — add `WORKSPACE_TEMPLATE_VARIABLES` constant.

### Files to delete:
- None.

## Implementation Steps

1. Create `backend/app/services/openclaw/workspace_template_writer.py`:
   ```python
   TEMPLATE_VARIABLES = {"agent_name", "board_name", "org_name", "date"}

   def render_template_content(
       raw_content: str,
       agent_name: str,
       board_name: str,
       org_name: str,
   ) -> str:
       """Simple variable substitution. No Jinja2."""
       replacements = {
           "{{agent_name}}": agent_name,
           "{{board_name}}": board_name,
           "{{org_name}}": org_name,
           "{{date}}": utcnow().date().isoformat(),
       }
       result = raw_content
       for key, value in replacements.items():
           result = result.replace(key, value)
       return result

   async def write_workspace_template_files(
       gateway_config: GatewayClientConfig,
       workspace_path: str,
       file_contents: dict[str, str],
       agent_name: str,
       board_name: str,
       org_name: str,
   ) -> list[str]:
       """Write rendered template files to gateway. Returns list of written filenames."""
   ```

2. Modify `provisioning.py` — in the workspace file write section:
   - Accept optional `template_file_contents: dict[str, str] | None` parameter.
   - If provided, call `write_workspace_template_files` instead of default Jinja2 rendering.
   - If not provided, keep current behavior (default templates).

3. Modify `provisioning_db.py` — in `AgentLifecycleService.create_agent()`:
   - Accept `template_id` from `AgentCreate` payload.
   - If `template_id` set, query `WorkspaceTemplate` and extract `file_contents`.
   - Pass `file_contents` to provisioner.
   - Store `template_id` on `Agent` record.

4. Add error handling:
   - Template fetch failure: log warning, fall back to defaults.
   - File write failure: log error, continue agent creation (degraded but functional).
   - Record failure reason in `agent.last_provision_error`.

5. Add constant `ALLOWED_WORKSPACE_TEMPLATE_FILES` to constants.py:
   ```python
   ALLOWED_WORKSPACE_TEMPLATE_FILES = frozenset({"AGENTS.md", "SOUL.md", "IDENTITY.md", "TOOLS.md"})
   ```

## Todo List
- [x] `workspace_template_writer.py` created with render + write functions.
- [x] `provisioning.py` updated with template-aware branch.
- [x] `provisioning_db.py` updated to fetch template and pass to provisioner.
- [x] Variable substitution working for all 4 variables (str.replace, no Jinja2).
- [x] Fallback to defaults when no template_id.
- [x] Error handling: graceful degradation on write failure.

## Success Criteria
- Agent created with `template_id` has workspace files written from template content.
- Agent created without `template_id` behaves exactly as before.
- Variable substitution works in template content.
- Write failures logged and do not block agent creation.

## Risk Assessment
- **Template injection**: mitigated by using simple `str.replace` instead of Jinja2.
- **Gateway file write permissions**: reuses existing write mechanism; no new permission concerns.
- **Race condition on shared workspace**: MVP is single-agent mode; no race.
- **Large template content**: validated at API layer (phase 2); won't exceed limits here.

## Security Considerations
- No Jinja2 on user content (prevents SSTI).
- Variable substitution is allowlist-only (4 variables).
- Template content already validated for no `${...}` env var references (phase 2).

# Code Review: Workspace Templates Feature

**Reviewer:** code-reviewer | **Date:** 2026-03-13 | **Branch:** feature/workspace-templates

## Scope
- **Files reviewed:** 18 (7 new backend, 7 modified backend, 3 new frontend, 1 modified frontend)
- **LOC (new):** ~900 backend, ~210 frontend
- **Focus:** Full-stack feature review -- security, correctness, edge cases, backward compat

## Overall Assessment

Solid implementation. Clean separation of concerns (model/schema/service/API/writer). Security-conscious design (str.replace over Jinja2, allowlisted file keys, size caps). Backward compat preserved (nullable template_id). Migration is correct and reversible. A few issues need attention before merge.

---

## Critical Issues

### C1. ICON_MAP missing all seed template icons (Frontend Bug)

**File:** `frontend/src/components/agents/template-card.tsx` lines 25-43

The seed templates define icons: `sparkles`, `headset`, `pencil`, `book-open`, `briefcase`, `smile`, `check-circle`. **None** of these exist in the `ICON_MAP`. Every seed template will render the fallback `FileText` icon, defeating the purpose of per-template icons.

**Fix:** Add missing mappings:
```tsx
import { Sparkles, Headphones, Pencil, BookOpen, Briefcase, Smile, CheckCircle } from "lucide-react";

// Add to ICON_MAP:
sparkles: Sparkles,
headset: Headphones,  // Lucide uses "Headphones" not "Headset"
pencil: Pencil,
"book-open": BookOpen,
briefcase: Briefcase,
smile: Smile,
"check-circle": CheckCircle,
```

### C2. UniqueConstraint on (organization_id, slug) does not work for system templates

**File:** `backend/app/models/workspace_templates.py` line 22

System templates have `organization_id = NULL`. In PostgreSQL, `UNIQUE(NULL, 'foo')` does NOT enforce uniqueness -- two system templates with the same slug can coexist because NULL != NULL.

**Impact:** If seed runs twice with code changes that reintroduce a slug, duplicates accumulate. The `ensure_seed_templates` currently checks by slug, but any direct DB manipulation or future code path could bypass this.

**Fix:** Add a partial unique index for system templates:
```python
# In migration:
op.create_index(
    "uq_workspace_templates_system_slug",
    "workspace_templates",
    ["slug"],
    unique=True,
    postgresql_where=sa.text("is_system = true"),
)
```

---

## High Priority

### H1. `get_template` service lacks org-scoping -- IDOR risk

**File:** `backend/app/services/workspace_templates.py` line 50-58

`get_template()` fetches by PK only. It's used by `update_template` and `delete_template` which check org access afterward -- but the API endpoint `GET /{template_id}` does the org check in the router (line 53). The service function itself is reusable and could be called without the org check from other code paths.

The `create_agent` flow in `provisioning_db.py` line 1735 also fetches the template directly via `session.get()` and checks org access -- correct, but duplicates logic.

**Recommendation:** Add an optional `organization_id` filter to `get_template()` so callers can enforce scope at the service layer.

### H2. Redundant template fetch in `create_agent`

**File:** `backend/app/services/openclaw/provisioning_db.py` lines 1760-1766

When `requested_name` is empty and `template_id` is set, the code fetches the template **again** from DB (line 1761). But it was already fetched at line 1735. Store the template object to avoid the redundant query:

```python
# Before the block:
resolved_template = template  # from line 1735
# Use resolved_template.name instead of re-fetching
```

### H3. Search filter does not search description

**File:** `frontend/src/components/agents/template-picker-step.tsx` line 51

Search only matches `t.name`. Users may search by description keywords (e.g., "troubleshoot", "SQL"). Add description to the search filter:

```tsx
const matchesSearch = !q || t.name.toLowerCase().includes(q)
  || (t.description?.toLowerCase().includes(q) ?? false);
```

---

## Medium Priority

### M1. `file_contents` type inconsistency: `dict[str, Any]` in model vs `dict[str, str]` in schema

**File:** `backend/app/models/workspace_templates.py` line 34 uses `dict[str, Any]` (JSONB). Schema and writer use `dict[str, str]`. The JSONB column can store non-string values. If someone inserts via DB directly, the writer's `str.replace` will crash on non-string content.

**Fix:** Cast values to str in `render_template_content` or validate at read time.

### M2. Slug collision resolution is weak

**File:** `backend/app/services/workspace_templates.py` line 82

On collision, appends `-HHMMSS`. If two templates are created in the same second, they collide again and the second insert fails with IntegrityError (unhandled).

**Fix:** Use a retry loop or append a short random suffix:
```python
slug = f"{slug}-{uuid4().hex[:6]}"
```

### M3. `update_template` skips slug update collision check

**File:** `backend/app/services/workspace_templates.py` line 123

When name changes, slug is regenerated but no collision check is performed (unlike `create_template`). Could violate the unique constraint.

### M4. Skeleton dark mode missing

**File:** `frontend/src/components/ui/skeleton.tsx` line 6

Uses `bg-slate-200` hardcoded. If the app supports dark mode, should add `dark:bg-slate-700`.

### M5. `WorkspaceTemplateUpdate` cannot clear description/category/icon to null

All optional fields default to `None`, but `update_template` line 120 skips `None` values. There's no way to clear a field once set. Consider using `model_dump(exclude_unset=True)` pattern (already used in API layer) but the service layer re-checks `is not None`.

---

## Low Priority

### L1. Missing `workspace-templates` in OPENAPI_TAGS list

**File:** `backend/app/main.py` -- the tag `workspace-templates` is not in `OPENAPI_TAGS` or `_OPENAPI_EXAMPLE_TAGS`. OpenAPI docs will show the tag without description.

### L2. Template card truncation uses magic number

**File:** `frontend/src/components/agents/template-card.tsx` line 60 -- `80`/`77` chars. Extract as constant for clarity.

### L3. No error state in TemplatePickerStep

If the API call fails, `isLoading` is false and `templates` is empty, showing "No templates found" instead of an error message. Should check `isError` from the query hook.

---

## Positive Observations

1. **Security-first templating** -- Using `str.replace` over Jinja2 to prevent SSTI is the right call.
2. **Allowlisted file keys** with size limits -- prevents abuse of the JSONB column.
3. **`${...}` env var rejection** in schema validation -- blocks template injection attempts.
4. **System template immutability** -- 403 on modify/delete is correctly enforced.
5. **Backward compatibility** -- `template_id` nullable throughout, existing agents unaffected.
6. **Clean migration** with proper downgrade path.
7. **Org isolation** checks are present at both API and provisioning layers.
8. **Seed idempotency** -- checks existing slugs before inserting.
9. **Frontend** -- good loading state with skeleton, accessible button elements, clean tab filtering.

---

## Recommended Actions (Priority Order)

1. **[C1]** Add missing icon mappings in `template-card.tsx` (all 7 seed icons)
2. **[C2]** Add partial unique index for system template slugs
3. **[H1]** Refactor `get_template` to accept optional org_id filter
4. **[H2]** Remove redundant template fetch in `create_agent`
5. **[H3]** Extend search to include description
6. **[M2/M3]** Fix slug collision handling in create and update
7. **[M5]** Support clearing nullable fields via update
8. **[L1]** Add `workspace-templates` tag to OPENAPI_TAGS
9. **[L3]** Add error state handling in TemplatePickerStep

---

## Unresolved Questions

1. Should `WorkspaceTemplateRead` expose `file_contents` to all authenticated users? For large templates, this could be a performance concern on the list endpoint. Consider a `?include_contents=true` query param.
2. Should seed template updates (content changes on existing slugs) be supported? Currently only new slugs are seeded -- existing ones are never updated.
3. The `Headset` icon name in seeds maps to `Headphones` in Lucide React. Confirm intended icon or update seed data.

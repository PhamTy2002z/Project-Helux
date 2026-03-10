# Phase 3: Add OpenAPI Refresh to Bootstrap

## Overview
- **Priority:** Medium
- **Status:** ✅ Completed
- **Effort:** 30m

Ensure lead agents run OpenAPI refresh during bootstrap so they have the operations TSV available from first session.

## Key Insights
- TOOLS.md has the OpenAPI refresh command but labels it "run before API-heavy work"
- BOOTSTRAP.md doesn't include this step — agent may never run it unless prompted
- Without the TSV, lead agents have no way to discover nudge/coordination endpoints
- Author's bootstrap also lacks this step — this is an improvement over upstream

## Related Code Files
- **Modify:** `backend/templates/BOARD_BOOTSTRAP.md.j2` (lead section, after step 6 heartbeat)
- **Reference:** `backend/templates/BOARD_TOOLS.md.j2` (OpenAPI refresh command)

## Implementation Steps

1. Edit `backend/templates/BOARD_BOOTSTRAP.md.j2`, add step after the heartbeat check-in (step 6) in the `{% if is_lead %}` block:

Insert as new step 7 (shift existing 7→8, 8→9):

```markdown
7) Refresh API operations catalog (required for coordination):

```bash
mkdir -p api
curl -fsS "{{ base_url }}/openapi.json" -o api/openapi.json
jq -r '
  .paths | to_entries[] as $p
  | $p.value | to_entries[]
  | select((.value.tags // []) | index("agent-lead"))
  | "\(.key|ascii_upcase)\t\($p.key)\t\(.value.operationId // "-")\t\(.value["x-llm-intent"] // "-")\t\(.value["x-when-to-use"] // [] | join(" | "))\t\(.value["x-routing-policy"] // [] | join(" | "))"
' api/openapi.json | sort > api/agent-lead-operations.tsv
```
```

2. Also add for worker agents (`{% else %}` block) as new step after heartbeat, using `agent-worker` tag instead of `agent-lead`.

3. Renumber subsequent steps in both branches.

## Todo List
- [x] Add OpenAPI refresh step to lead bootstrap
- [x] Add OpenAPI refresh step to worker bootstrap
- [x] Renumber subsequent steps
- [x] Verify template renders correctly

## Success Criteria
- ✅ After bootstrap, `api/agent-lead-operations.tsv` exists with nudge endpoint listed
- ✅ Worker agents have `api/agent-worker-operations.tsv`
- ✅ Existing bootstrap steps unaffected
- ✅ Template syntax verified for both agent types

## Implementation Notes
- OpenAPI refresh added as step 7 for lead agents (after heartbeat check-in)
- Uses jq to filter operations by `agent-lead` tag
- Generates TSV with operation name, method, path, intent, and routing policy
- Worker agents get parallel step using `agent-worker` tag
- Subsequent steps renumbered accordingly
- Bootstrap already checks for curl and jq prerequisites

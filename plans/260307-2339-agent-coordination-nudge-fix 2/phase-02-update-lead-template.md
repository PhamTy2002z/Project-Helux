# Phase 2: Update Lead Template with Coordination Guidance

## Overview
- **Priority:** High
- **Status:** ✅ Completed
- **Effort:** 1.5h

Add coordination section to BOARD_AGENTS.md.j2 lead section so lead agents know how to nudge board members via API.

## Key Insights
- Author's design: agents discover APIs via OpenAPI refresh → TSV (TOOLS.md already has this)
- BOARD_AGENTS.md.j2 Main Agent section has explicit API curl examples for delegation
- Lead Agent section lacks equivalent coordination instructions — only mentions @mentions and task comments
- Must NOT hardcode endpoint paths per TOOLS.md policy ("Do not hardcode endpoint paths in markdown files")
- Instead: reference the TSV and explain coordination capabilities conceptually

## Related Code Files
- **Modify:** `backend/templates/BOARD_AGENTS.md.j2` (lead section, after line ~205)
- **Reference:** `backend/templates/BOARD_TOOLS.md.j2` (OpenAPI refresh pattern)
- **Reference:** `backend/app/api/agent.py:1338-1394` (nudge endpoint with x-llm-intent metadata)

## Architecture

Flow after fix:
```
Lead reads AGENTS.md → learns about coordination capabilities
Lead reads TOOLS.md → runs OpenAPI refresh → gets operations TSV
Lead finds `agent_lead_nudge_agent` in TSV with intent "agent_coordination"
Lead calls POST .../boards/{id}/agents/{id}/nudge via curl
coordination_service.nudge_board_agent() → gateway RPC → target session
Target agent receives message, processes, reports back
```

## Implementation Steps

1. Edit `backend/templates/BOARD_AGENTS.md.j2`, insert new section in the `{% if is_lead %}` block after "### Out of scope" (line ~231) and before "### Definition of Done":

Add a `## Agent Coordination` section containing:

```markdown
## Agent Coordination

You can coordinate with board agents via Mission Control API (not OpenClaw chat).

### Available coordination actions
- **Nudge agent**: Re-engage a stalled/idle agent with a targeted message
- **Read agent soul**: Inspect an agent's SOUL.md for role understanding
- **Update agent soul**: Modify an agent's core instructions

### How to discover endpoints
Run the OpenAPI refresh from `TOOLS.md` first:
```bash
# See TOOLS.md for the full refresh command
```
Then check `api/agent-lead-operations.tsv` for operations matching your intent.

### When to nudge
- Agent is stalled or idle with no recent updates
- Agent needs redirection or clarification
- Agent hasn't responded to @mention in chat

### When NOT to nudge
- For broadcast messages (use board chat instead)
- When no specific target or follow-up needed
- For routine status requests (use heartbeat/task system)

### Reply mechanism
- Nudge messages are delivered directly to the agent's gateway session
- Agent responses come through task comments or board memory
- Monitor activity log for nudge delivery confirmation
```

2. Verify the new section renders correctly for lead agents by checking template logic:
   - `{% if is_lead %}` condition wraps the section
   - No hardcoded endpoint paths
   - References TOOLS.md OpenAPI refresh pattern

3. Verify the section does NOT appear for:
   - Main agents (has its own delegation section)
   - Worker agents (should escalate to @lead, not nudge peers)

## Todo List
- [x] Add "Agent Coordination" section to lead block in BOARD_AGENTS.md.j2
- [x] Ensure no hardcoded paths — reference TSV discovery
- [x] Verify template renders correctly for is_lead=true
- [x] Verify section hidden for is_lead=false and is_main=true

## Success Criteria
- ✅ Added Agent Coordination section to lead agents only
- ✅ No hardcoded API paths in template
- ✅ References OpenAPI refresh TSV as source of truth
- ✅ Section explains when to nudge and reply mechanism
- ✅ Template renders clean, conditional markdown

## Implementation Notes
- Section added after "Out of scope" in `{% if is_lead %}` block
- Explains nudge purpose: re-engage stalled agents with targeted messages
- Directs lead agents to run OpenAPI refresh to discover endpoints
- Clarifies when NOT to nudge (broadcasts, routine status)
- Notes reply mechanism via task comments and board memory

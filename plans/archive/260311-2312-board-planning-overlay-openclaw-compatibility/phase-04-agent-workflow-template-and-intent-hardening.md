# Phase 04 - Agent Workflow Template And Intent Hardening

## Context Links
- `backend/templates/BOARD_HEARTBEAT.md.j2`
- `backend/templates/BOARD_AGENTS.md.j2`
- `backend/templates/BOARD_TOOLS.md.j2`
- `backend/app/api/agent.py`

## Overview
- Priority: P1
- Status: Completed
- Scope: keep agent behavior stable, improve deterministic task selection at scale.

## Key Insights
- Worker loop currently pulls status buckets; with large boards it needs tighter filter guidance.
- Template guidance and `x-llm-intent` routing are critical runtime contracts.

## Requirements
- Functional:
  1. Update templates to prefer filtered task pulls (assigned + actionable).
  2. Keep comment/update protocol unchanged.
  3. Add explicit guidance: task groups are planning metadata; execute leaf tasks only.
- Non-functional:
  1. No increase in heartbeat failure rate.
  2. No workflow drift for existing boards not using task groups.

## Architecture
- Template-only behavior upgrade, not endpoint replacement.
- OpenAPI hints stay consistent; add examples for filter usage.

## Related Code Files
- Modify:
  - `backend/templates/BOARD_HEARTBEAT.md.j2`
  - `backend/templates/BOARD_AGENTS.md.j2`
  - `backend/app/api/agent.py` (OpenAPI hints/examples)
- Create:
  - `backend/tests/test_agent_heartbeat_task_selection_contract.py`
- Delete:
  - none

## Implementation Steps
1. Add deterministic filter recipes in heartbeat template.
2. Extend routing examples in agent OpenAPI metadata.
3. Add tests that simulate worker/lead selection loops.

## Todo List
- [x] Template updates committed
- [x] OpenAPI hints refreshed
- [x] Agent loop contract tests green

## Success Criteria
- Agents keep current workflow semantics and reduce noisy task scans.

## Risk Assessment
- Risk: prompt drift causes unintended route usage.
- Mitigation: contract tests + explicit negative guidance in OpenAPI metadata.

## Security Considerations
- No expansion of agent auth scopes.
- Preserve write restrictions and board access checks.

## Next Steps
- Build frontend overlay that consumes new scalable query path.

# Phase 01 - Contract Lock And Compatibility Guardrails

## Context Links
- `docs/openclaw-specs.md`
- `backend/templates/BOARD_HEARTBEAT.md.j2`
- `backend/app/api/agent.py`
- `backend/app/api/tasks.py`
- `backend/app/schemas/tasks.py`

## Overview
- Priority: P1
- Status: Completed
- Scope: lock non-negotiable contracts before schema/UI change.

## Key Insights
- Agent execution loop hard-depends on 4-status task model and existing board task route.
- Lead/worker transitions enforce board rules and cannot be bypassed by UI-only logic.

## Requirements
- Functional:
  1. Define immutable compatibility checklist used in PR gates.
  2. Define additive-only policy for schema/API changes.
- Non-functional:
  1. Zero behavior drift for existing agent flows.
  2. All new behavior hidden behind feature flags.

## Architecture
- Add a contract matrix doc mapped to:
  1. status enum and transition rules,
  2. agent task discovery endpoint,
  3. event taxonomy,
  4. heartbeat template assumptions.

## Related Code Files
- Modify:
  - `docs/openclaw-specs.md`
  - `docs/system-architecture.md`
  - `docs/code-standards.md`
  - `backend/tests/test_agent_task_contracts.py` (new if missing)
- Create:
  - `docs/reference/board-planning-overlay-contract-matrix.md`
- Delete:
  - none

## Implementation Steps
1. Extract current runtime contracts from APIs/templates/tests.
2. Publish contract matrix with “must keep” and “allowed additive” sections.
3. Add CI tests that fail on contract drift.
4. Add rollout gate checklist for later phases.

## Todo List
- [x] Contract matrix committed
- [x] Contract tests green
- [x] CI gate documented

## Success Criteria
- Contract matrix accepted by team.
- Tests prove unchanged behavior for existing clients/agents.

## Risk Assessment
- Risk: hidden dependencies in agent prompts not captured.
- Mitigation: include template + OpenAPI examples in matrix.

## Security Considerations
- No auth model change.
- No token/session handling change.

## Next Steps
- Start schema design with matrix as hard constraint.

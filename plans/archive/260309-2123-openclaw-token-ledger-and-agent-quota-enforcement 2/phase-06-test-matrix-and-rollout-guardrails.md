# Phase 06: Test Matrix And Rollout Guardrails

## Context Links
- [Backend entitlement tests](../../backend/tests/services/test_entitlements.py)
- [Backend quota API tests](../../backend/tests/api/test_quota_enforcement.py)
- [Frontend agents table tests](../../frontend/src/components/agents/AgentsTable.test.tsx)
- [Frontend user menu tests](../../frontend/src/components/organisms/UserMenu.test.tsx)
- [Roadmap doc](../../docs/project-roadmap.md)

## Overview
- Priority: P1
- Status: Completed
- Goal: ship safely with strong test coverage, observability, and controlled enablement.

## Key Insights
- Enforcement changes runtime behavior; test coverage must include false-block and double-charge edge cases.
- Day-boundary logic (VN timezone) is high-risk and must be deterministic in tests.

## Requirements
- Functional:
  - Test billing math + delta/idempotency.
  - Test quota block behavior on dispatch/send.
  - Test UI rendering for token columns and `Basic` labels.
- Non-functional:
  - Add telemetry for sync failures and block events.
  - Provide rollback switch (`observe` mode).

## Architecture
- Backend tests:
  - Service unit tests for `AgentTokenQuotaService`.
  - API tests for message send blocked with `quota_exceeded` payload.
  - Entitlement usage tests aggregated from ledger.
- Frontend tests:
  - AgentsTable token cell and blocked state.
  - UserMenu/Shell labels now show `Basic`.

## Related Code Files
- Modify:
  - `backend/tests/services/test_entitlements.py`
  - `backend/tests/api/test_gateways_authz.py`
  - `backend/tests/api/test_quota_enforcement.py`
  - `frontend/src/components/agents/AgentsTable.test.tsx`
  - `frontend/src/components/organisms/UserMenu.test.tsx`
  - `docs/project-roadmap.md`
  - `docs/project-changelog.md`
- Create:
  - `backend/tests/services/test_agent_token_quota_service.py`
  - `backend/tests/api/test_agent_token_dispatch_enforcement.py`
- Delete:
  - None

## Implementation Steps
1. Add deterministic fixture for VN day rollover.
2. Add unit tests for delta math (`100000 -> 50000` billed).
3. Add integration tests for block/unblock across day reset.
4. Add frontend tests for token column + Basic label.
5. Add runtime logging/metrics for sync failures and blocked sends.
6. Document rollout: `observe` -> `enforce`.

## Todo List
- [x] Add backend unit + API test suites.
- [x] Add frontend rendering tests.
- [x] Add observability counters/log events.
- [x] Update roadmap/changelog docs after implementation.

## Success Criteria
- Test suite covers math, enforcement, timezone, and UI surfaces.
- Feature can be enabled gradually without service outage.
- Clear rollback path exists.

## Risk Assessment
- Risk: strict enforcement can block valid operations if OpenClaw usage API transiently fails.
- Mitigation: rollout with observe mode first; enforce only after stability window.

## Security Considerations
- Validate org/board ownership before resolving agent usage.
- Avoid exposing raw transcript or model content in logs/errors.

## Next Steps
- Move to implementation with `/ck:cook` using this plan path.

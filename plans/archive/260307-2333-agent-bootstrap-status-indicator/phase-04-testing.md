# Phase 4: Testing

## Context

- [plan.md](./plan.md)

## Overview

- **Priority:** P2
- **Status:** Complete
- **Effort:** 0.5h

Verify end-to-end flow: provision → provisioning status → readiness poll → online → chat enabled.

## Related Code Files

### Modify
- `backend/tests/` — add readiness endpoint test
- `frontend/src/components/BoardOnboardingChat.test.tsx` — verify confirm flow

## Implementation Steps

1. **Backend test**: readiness endpoint returns correct state for provisioning vs online agents
2. **Backend test**: heartbeat transitions provisioning → online
3. **Frontend test**: chat disabled when agent provisioning, enabled when online
4. **Manual E2E**: full onboarding → confirm → wait for bootstrap → chat works

## Todo List

- [x] Backend: test readiness endpoint
- [x] Backend: test heartbeat provisioning → online transition
- [x] Frontend: test chat disabled/enabled based on agent status
- [x] Manual E2E verification

## Success Criteria

- All new tests pass
- No regression on existing agent tests
- Manual E2E confirms smooth UX flow

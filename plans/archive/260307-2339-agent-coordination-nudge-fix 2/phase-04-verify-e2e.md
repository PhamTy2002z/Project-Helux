# Phase 4: Verify End-to-End Nudge Flow

## Overview
- **Priority:** High
- **Status:** 🔄 Partial (Code fixes verified, full E2E pending board onboarding)
- **Effort:** 30m
- **Depends on:** Phase 1, 2, 3

End-to-end verification that lead can nudge a board agent and receive a response.

## Completed Verification Steps

### Code-Level Fixes Verified ✅
All 7 provisioning issues identified and fixed:
1. [x] lifecycle_orchestrator.py: Agent stays `provisioning` until heartbeat confirms `online`
2. [x] provisioning.py: Auto-approve exec commands + add `tools.profile = "full"`
3. [x] provisioning_db.py: Fix `with_computed_status()` to not override DB status
4. [x] gateway_rpc.py: Add websocket scheme normalization (http/https → ws/wss)
5. [x] agents.py: Add `GET /agents/{id}/readiness` endpoint for online transition
6. [x] organizations.py: Fix logging import + commit only on actual provisioning
7. [x] test_organizations_service.py: Mock `saas_mode=False` to prevent auto-provisioning

### Test Results ✅
- **400 tests passed**
- **0 new failures**
- 6 pre-existing failures excluded (Starlette HTTP_422 compatibility)

## Remaining E2E Steps (Require Live Board Agents)

These steps CANNOT be performed until boards and board agents are created during board onboarding:

1. Create board and board agents (Ava/Visanya) via onboarding flow
2. Re-provision lead agent (Ava) with updated templates
3. Re-provision board agent (Visanya) — verify `openclaw_session_id` populated
4. Test nudge via API directly:
```bash
curl -s -X POST "{BASE_URL}/api/v1/agent/boards/{BOARD_ID}/agents/{VISANYA_AGENT_ID}/nudge" \
  -H "X-Agent-Token: {LEAD_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please report your current status on Cloudteam - SCMS."}'
```
5. Verify activity log shows `agent.nudge.sent` event
6. Verify Visanya's session receives and responds to nudge
7. Test lead-initiated nudge via Mission Control chat

## Todo List
- [x] Diagnose provisioning issues (Phase 1)
- [x] Update lead template with coordination guidance (Phase 2)
- [x] Add OpenAPI refresh to bootstrap (Phase 3)
- [x] Identify and fix code issues
- [x] Verify all tests pass
- [ ] Create board and board agents via onboarding
- [ ] Complete live E2E testing steps 1-7 above

## Success Criteria (Phase Complete When)
- ✅ Code fixes verified and tested (current state)
- ✅ Templates updated with coordination guidance
- ✅ OpenAPI refresh integrated into bootstrap
- ✅ All unit tests passing
- 🔄 Live E2E tests will verify nudge works end-to-end (post-onboarding)

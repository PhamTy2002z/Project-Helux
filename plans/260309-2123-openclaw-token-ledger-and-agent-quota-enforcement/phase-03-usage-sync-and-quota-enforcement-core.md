# Phase 03: Usage Sync And Quota Enforcement Core

## Context Links
- [Gateway dispatch service](../../backend/app/services/openclaw/gateway_dispatch.py)
- [Gateway session service](../../backend/app/services/openclaw/session_service.py)
- [Entitlement policies](../../backend/app/services/entitlements.py)
- [Agent lifecycle/session key logic](../../backend/app/services/openclaw/provisioning_db.py)

## Overview
- Priority: P1
- Status: Pending
- Goal: sync OpenClaw usage into ledger and hard-block board-scoped agent dispatch on daily cap.

## Key Insights
- Most agent runtime dispatch goes through `GatewayDispatchService.send_agent_message`.
- Manual send endpoint `/gateways/sessions/{session_id}/message` can bypass dispatch checks if not guarded.
- Gateway-main messages are separate and should remain unchanged for this feature.

## Requirements
- Functional:
  - Before sending to board-scoped agent session, sync current day usage from OpenClaw.
  - Apply formula: `billed_delta = ceil(openclaw_delta_tokens * 0.5)`.
  - Enforce per-agent daily limit from current plan (`agent_daily_tokens`).
  - Return quota error when blocked (`429`, `code=quota_exceeded`).
- Non-functional:
  - Idempotent under retries.
  - Transaction-safe under concurrent sends.

## Architecture
- New service: `AgentTokenQuotaService`
  - `sync_and_enforce(agent, organization_id, gateway_config)`
  - Fetch usage via `sessions.usage` for VN day (`mode=specific`, `utcOffset=UTC+7`).
  - Compute delta from ledger cumulative total.
  - Update ledger row atomically.
  - Compare with policy limit and raise block error if exceeded.
- Enforcement insertion points:
  - `GatewayDispatchService.send_agent_message` (primary path)
  - `GatewaySessionService.send_session_message` (manual path)

## Related Code Files
- Modify:
  - `backend/app/services/openclaw/gateway_dispatch.py`
  - `backend/app/services/openclaw/session_service.py`
  - `backend/app/services/entitlements.py`
  - `backend/app/core/config.py`
- Create:
  - `backend/app/services/agent_token_quota_service.py`
  - `backend/app/services/openclaw/session_usage_sync.py`
- Delete:
  - None

## Implementation Steps
1. Build resolver `session_key -> board-scoped Agent` inside org context.
2. Implement usage sync (OpenClaw call + parser + ledger atomic update).
3. Add quota comparison using `policy_for_tier(...).agent_daily_tokens`.
4. Raise structured `HTTPException(429)` on limit reach.
5. Wire checks into dispatch/session send flows before `chat.send`.
6. Add guard for unsupported gateway capabilities (clear error semantics).

## Todo List
- [ ] Implement idempotent sync math with delta and ceil(0.5x).
- [ ] Add enforcement hooks at both send entry points.
- [ ] Keep gateway-main path unchanged.
- [ ] Add structured quota error payload.

## Success Criteria
- Board-scoped agent stops receiving new dispatch when daily cap reached.
- `100,000 OpenClaw tokens -> 50,000 billed tokens` behavior validated.
- No double-charge on repeated sync.

## Risk Assessment
- Risk: enforcement false-positive due stale/missing usage data.
- Mitigation: short retry, explicit sync failure policy, strong tests on day rollover and retries.

## Security Considerations
- Enforce within org boundary only.
- Prevent cross-org session key resolution.

## Next Steps
- Expose usage fields via read models in phase 04.

# Phase 01: OpenClaw Capability And Contract Lock

## Context Links
- [Research: OpenClaw usage mechanism](./research/researcher-01-openclaw-usage-mechanism.md)
- [Gateway RPC client](../../backend/app/services/openclaw/gateway_rpc.py)
- [Gateway session service](../../backend/app/services/openclaw/session_service.py)
- [Gateway compatibility checks](../../backend/app/services/openclaw/gateway_compat.py)

## Overview
- Priority: P1
- Status: Pending
- Goal: lock exact OpenClaw methods/payloads used for per-agent accounting, add capability checks before enforcement.

## Key Insights
- OpenClaw `sessions.usage` gives per-session `usage.totalTokens` + aggregates.
- `mode: specific` + `utcOffset: UTC+7` supports VN day boundary.
- Mission Control currently has no typed wrapper for `sessions.usage*`.

## Requirements
- Functional:
  - Confirm runtime method availability for `sessions.usage`.
  - Define parser contract for token extraction from response.
  - Define failure policy when method unavailable.
- Non-functional:
  - No breaking changes for existing gateway status/session endpoints.
  - Clear logs for capability failures.

## Architecture
- Add lightweight OpenClaw usage client module:
  - `fetch_session_usage(key, start_date, end_date, mode, utc_offset)`
- Add capability probe strategy:
  - Probe once per gateway lifecycle (cache short TTL in process).
  - If unsupported, return deterministic error code for enforcement layer.

## Related Code Files
- Modify:
  - `backend/app/services/openclaw/gateway_rpc.py`
  - `backend/app/services/openclaw/session_service.py`
  - `backend/app/services/openclaw/gateway_compat.py`
- Create:
  - `backend/app/services/openclaw/usage_client.py`
  - `backend/app/schemas/openclaw_usage.py`
- Delete:
  - None

## Implementation Steps
1. Add typed helper calling `openclaw_call("sessions.usage", ...)`.
2. Add response parser for `sessions[0].usage.totalTokens` (strict validation, safe fallback).
3. Add explicit error mapping for method-not-found/unsupported runtime.
4. Add feature flag/config guard for enforcement mode (`observe` vs `enforce`).
5. Add logs with gateway id, session key, request range, and parse outcomes.

## Todo List
- [ ] Define stable parser for OpenClaw usage payload.
- [ ] Add capability probe + cache.
- [ ] Add deterministic error surface for unsupported gateway.
- [ ] Add config switches for safe rollout.

## Success Criteria
- Calling usage helper on supported gateways returns validated token totals.
- Unsupported gateways produce predictable, test-covered failure mode.
- No regressions in existing gateway APIs.

## Risk Assessment
- Risk: payload schema drift upstream.
- Mitigation: strict parser with fallback path + explicit errors + tests.

## Security Considerations
- Never log gateway token.
- Redact session content; only log metadata and token numbers.

## Next Steps
- Continue with persistent ledger model in phase 02.

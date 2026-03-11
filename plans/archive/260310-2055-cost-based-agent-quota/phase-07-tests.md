# Phase 7: Tests

## Context

- [Existing quota tests](../../backend/tests/services/test_agent_token_quota_service.py)
- [Entitlement tests](../../backend/tests/services/test_entitlements.py)
- [Gateway quota tests](../../backend/tests/test_gateway_quota_commit_behavior.py)
- [AgentsTable tests](../../frontend/src/components/agents/AgentsTable.test.tsx)

## Overview

- **Priority**: P2
- **Status**: pending
- **Effort**: 1.5h

Update existing tests + add new tests for cost-based enforcement.

## Test Plan

### Backend: Parser tests

File: `backend/tests/schemas/test_openclaw_usage.py` (create if not exists)

- [ ] `test_parse_session_usage_extracts_cost_fields` - cost + missingCostEntries parsed
- [ ] `test_parse_session_usage_defaults_cost_when_missing` - backward compat with old payload
- [ ] `test_coerce_cost_handles_various_types` - int, float, str, negative, bool

### Backend: Sync service tests

File: `backend/tests/services/test_session_usage_sync.py` (create if not exists)

- [ ] `test_sync_tracks_cost_delta` - cost_used increments correctly
- [ ] `test_sync_first_sync_zeroes_cost_delta` - baseline logic
- [ ] `test_sync_uses_raw_tokens_no_multiplier` - billed_delta == openclaw_delta

### Backend: Quota enforcement tests

File: `backend/tests/services/test_agent_token_quota_service.py` (update)

- [ ] `test_sync_and_enforce_blocks_on_cost_quota_exceeded` - cost exceeds, gets 429
- [ ] `test_sync_and_enforce_blocks_on_token_cap_when_cost_data_unavailable` - fallback path
- [ ] `test_sync_and_enforce_cost_checked_first_then_token_cap` - cost blocks before token
- [ ] `test_sync_and_enforce_passes_when_both_layers_within_limit` - happy path
- [ ] Update existing tests: change `billed_total` expectations (no 0.5x), add cost fields to fake sync results

### Backend: Entitlement tests

File: `backend/tests/services/test_entitlements.py` (update)

- [ ] `test_policy_includes_cost_limits` - new fields present in policies
- [ ] `test_entitlement_usage_includes_cost_quotas` - cost entries in response
- [ ] Update existing: token limits changed (100K/500K raw vs 15K/35K billed)

### Frontend: Component tests

File: `frontend/src/components/agents/AgentsTable.test.tsx` (update)

- [ ] Update fixtures with cost fields
- [ ] `test_renders_cost_usage_when_available` - shows dollar amounts
- [ ] `test_falls_back_to_token_display` - when cost fields null

File: `frontend/src/components/billing/quota-summary.tsx` (verify, may not need test changes)

## Implementation Steps

1. Fix existing tests first (remove 0.5x expectations, update token limits)
2. Add parser unit tests
3. Add sync service cost delta tests
4. Add 2-layer enforcement tests
5. Update frontend test fixtures
6. Run full test suite

## Success Criteria

- All existing tests pass with updated expectations
- New cost enforcement paths covered
- Fallback path (cost unavailable) covered
- Frontend renders correctly with and without cost data
- `pytest` and `vitest` both green

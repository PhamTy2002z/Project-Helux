# Phase 4: Enforcement Service 2-Layer Quota

## Context

- [Quota service](../../backend/app/services/agent_token_quota_service.py) - currently only checks `billed_tokens_used` vs `agent_daily_tokens`

## Overview

- **Priority**: P1
- **Status**: pending
- **Effort**: 2h

Implement 2-layer enforcement: cost quota (primary) then token hard-cap (safety net).

## Enforcement Logic

```
sync_result = sync_session_usage(...)

# Layer 1: Cost quota (primary, when data available)
if cost_data_available and policy.agent_daily_cost is not None:
    if sync_result.cost_total >= policy.agent_daily_cost:
        -> block with resource="agent_daily_cost"

# Layer 2: Token hard-cap (safety net, always checked)
if policy.agent_daily_tokens is not None:
    if sync_result.billed_total >= policy.agent_daily_tokens:
        -> block with resource="agent_daily_tokens"

# Both pass -> allow
```

## Key Changes

1. **Expand `AgentQuotaSyncOutcome`** with cost fields
2. **Update `sync_and_enforce`** with 2-layer check
3. **Separate `_mark_blocked_if_needed`** to set `cost_blocked_at` vs `blocked_at`

## Related Code Files

### Files to modify:
- `backend/app/services/agent_token_quota_service.py`

## Implementation Steps

1. **Expand `AgentQuotaSyncOutcome`**:
   ```python
   @dataclass(frozen=True, slots=True)
   class AgentQuotaSyncOutcome:
       agent_id: UUID
       organization_id: UUID
       billed_total: int
       billed_delta: int
       token_limit: int | None
       cost_total: Decimal
       cost_delta: Decimal
       cost_limit: Decimal | None
       quota_reached: bool
       blocked_by: str | None  # "agent_daily_cost" | "agent_daily_tokens" | None
   ```

2. **Update enforcement flow in `sync_and_enforce`**:
   - Resolve policy (already done)
   - Check cost limit first (if `cost_data_available` and `agent_daily_cost` set)
   - Check token limit second (always, as safety net)
   - Single blocking path with `resource` parameter

3. **Update 429 response** to include cost info:
   ```python
   detail = {
       "code": "quota_exceeded",
       "resource": "agent_daily_cost",  # or "agent_daily_tokens"
       "plan": tier,
       "cost_used": str(sync_result.cost_total),
       "cost_limit": str(policy.agent_daily_cost),
       "token_used": sync_result.billed_total,
       "token_limit": policy.agent_daily_tokens,
       ...
   }
   ```

4. **Extract enforcement check into helper** to avoid duplication:
   ```python
   def _check_quota(self, *, value, limit, resource, ...) -> bool
   ```

## Todo

- [ ] Expand `AgentQuotaSyncOutcome` with cost fields
- [ ] Implement 2-layer check in `sync_and_enforce`
- [ ] Update `_mark_blocked_if_needed` for cost blocking
- [ ] Update 429 response detail with cost info
- [ ] Keep file under 200 lines (extract helper if needed)

## Success Criteria

- Cost limit checked first when cost data available
- Token cap always checked as safety net
- Falls back to token-only when cost data unavailable
- Observe mode logs cost quota reached without blocking
- Enforce mode blocks and sets appropriate `blocked_at`/`cost_blocked_at`

## Security Considerations

- No new auth surfaces
- Cost values in error responses are internal billing data (acceptable for API clients)

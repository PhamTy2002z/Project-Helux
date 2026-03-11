# Phase 5: Entitlement Policy and Read Model

## Context

- [Entitlements](../../backend/app/services/entitlements.py) - `EntitlementPolicy`, `PLAN_POLICIES`, usage read
- [Read model](../../backend/app/services/agent_usage_read_model.py) - `AgentTokenUsageSnapshot`
- [Agent schema](../../backend/app/schemas/agents.py) - `AgentRead` with `token_*` fields
- [Entitlement schema](../../backend/app/schemas/entitlements.py) - `QuotaUsage`

## Overview

- **Priority**: P2
- **Status**: pending
- **Effort**: 1.5h

Add cost limits to policy, expose cost usage in API responses.

## Related Code Files

### Files to modify:
- `backend/app/services/entitlements.py` - add cost fields to policy + PLAN_POLICIES + usage read
- `backend/app/services/agent_usage_read_model.py` - add cost to snapshot
- `backend/app/schemas/agents.py` - add cost fields to AgentRead
- `backend/app/schemas/entitlements.py` - QuotaUsage already supports generic resources (no change needed)

## Implementation Steps

### 1. Update `EntitlementPolicy`

Add to dataclass:
```python
agent_daily_cost: Decimal | None    # USD per agent per day
org_daily_cost: Decimal | None      # USD per org per day
```

### 2. Update `PLAN_POLICIES`

```python
"trial_7d": EntitlementPolicy(
    ...,
    agent_daily_tokens=100_000,     # was 15_000 (now raw, no multiplier)
    org_daily_tokens=300_000,       # was 40_000
    agent_daily_cost=Decimal("0.50"),
    org_daily_cost=Decimal("1.50"),
),
"pro": EntitlementPolicy(
    ...,
    agent_daily_tokens=500_000,     # was 35_000
    org_daily_tokens=1_500_000,     # was 300_000
    agent_daily_cost=Decimal("2.00"),
    org_daily_cost=Decimal("10.00"),
),
```

Note: token limits increase because they were previously billed at 0.5x. Now raw tokens = 2x the old billed amount. Trial was 15K billed = 30K raw, bumped to 100K for safety net headroom.

### 3. Update `AgentTokenUsageSnapshot`

Add:
```python
cost_used_today: Decimal
cost_limit_today: Decimal | None
cost_remaining_today: Decimal | None
```

### 4. Update `AgentTokenUsageReadModel.snapshots_for_agents`

- Read `cost_used` from daily row
- Resolve `agent_daily_cost` from policy
- Compute `cost_remaining_today`

### 5. Update `AgentRead` schema

Add alongside existing `token_*` fields:
```python
cost_used_today: float | None = Field(default=None, description="USD cost for current day.")
cost_limit_today: float | None = Field(default=None, description="Daily cost limit (USD).")
cost_remaining_today: float | None = Field(default=None, description="Remaining cost budget (USD).")
```

Use `float` in schema (JSON-friendly); internal uses `Decimal`.

### 6. Update `get_entitlement_usage`

Add cost quota entries:
```python
_usage_entry(resource="agent_daily_cost", used=..., limit=policy.agent_daily_cost)
_usage_entry(resource="org_daily_cost", used=..., limit=policy.org_daily_cost)
```

Note: `QuotaUsage.used` is `int` - need to either change to `float` or add a parallel `CostQuotaUsage` schema. Simplest: change `used`/`limit`/`remaining` to `float` in `QuotaUsage` (backward compat since int is subset of float in JSON).

### 7. Update `_token_usage_from_ledger`

Add cost aggregation query alongside token aggregation.

## Todo

- [ ] Add `agent_daily_cost`, `org_daily_cost` to `EntitlementPolicy`
- [ ] Update `PLAN_POLICIES` with cost limits and adjusted token limits
- [ ] Add cost fields to `AgentTokenUsageSnapshot`
- [ ] Update `snapshots_for_agents` to read cost from ledger
- [ ] Add `cost_*` fields to `AgentRead` schema
- [ ] Update `QuotaUsage.used/limit/remaining` from `int` to `float`
- [ ] Add cost entries in `get_entitlement_usage`
- [ ] Update `_token_usage_from_ledger` for cost aggregation

## Success Criteria

- API returns cost usage alongside token usage
- QuotaSummary page shows cost quotas
- Existing token fields remain functional
- Schema changes backward compatible (additive + type widening)

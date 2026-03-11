# Phase 3: Sync Service Cost Tracking

## Context

- [Sync service](../../backend/app/services/openclaw/session_usage_sync.py) - currently only syncs tokens with 0.5x multiplier

## Overview

- **Priority**: P1
- **Status**: pending
- **Effort**: 2h

Update `SessionUsageSyncService` to track cost deltas alongside token deltas. Remove 0.5x multiplier. Use raw tokens for token cap.

## Key Changes

1. **Remove `_BILLING_MULTIPLIER = 0.5`** - no longer needed
2. **`billed_tokens_used` becomes raw token accumulator** - `billed_delta = openclaw_delta` (no multiplier)
3. **Add cost delta tracking** - same pattern as token delta but for USD cost
4. **Expand `SessionUsageSyncResult`** with cost fields

## Related Code Files

### Files to modify:
- `backend/app/services/openclaw/session_usage_sync.py` - main changes

## Implementation Steps

1. **Remove `_BILLING_MULTIPLIER`**

2. **Expand `SessionUsageSyncResult`**:
   ```python
   @dataclass(frozen=True, slots=True)
   class SessionUsageSyncResult:
       agent_id: str
       organization_id: str
       usage_date_vn: date
       openclaw_total: int
       openclaw_delta: int
       billed_delta: int          # now raw delta (no multiplier)
       billed_total: int          # now raw total
       cost_delta: Decimal        # NEW
       cost_total: Decimal        # NEW
       cost_data_available: bool  # NEW - False when missingCostEntries > 0
   ```

3. **Update `sync_session_usage` method**:
   - After fetching usage, extract `total_cost` and `missing_cost_entries`
   - Compute cost delta: `max(new_cost - previous_cost, 0)`
   - Apply same first-sync baseline logic for cost (skip delta if first sync)
   - Update row: `row.openclaw_cost_total`, `row.cost_used`
   - Set `cost_data_available = usage.missing_cost_entries == 0 or usage.total_cost > 0`

4. **Update `_ensure_daily_row`**:
   - Add `openclaw_cost_total: 0` and `cost_used: 0` to insert values

5. **Token delta calculation** (simplified):
   ```python
   billed_delta = openclaw_delta  # raw, no multiplier
   ```

## Todo

- [ ] Remove `_BILLING_MULTIPLIER`
- [ ] Expand `SessionUsageSyncResult` with cost fields
- [ ] Add cost delta computation in `sync_session_usage`
- [ ] Update `_ensure_daily_row` with cost defaults
- [ ] Update billed_delta to use raw tokens (no 0.5x)
- [ ] Keep file under 200 lines

## Success Criteria

- Token sync uses raw counts (no multiplier)
- Cost delta computed and persisted correctly
- First-sync baseline logic applies to both tokens and cost
- `cost_data_available` flag correctly reflects `missingCostEntries`

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Cost goes backwards (OpenClaw correction) | `max(delta, 0)` prevents negative deltas |
| First sync has large cost | Baseline logic zeros both token and cost delta on first sync |

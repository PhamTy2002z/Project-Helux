# Phase 1: DB Migration and Model Update

## Context

- [Model](../../backend/app/models/agent_token_daily_usage.py)
- [Existing migration](../../backend/migrations/versions/d4e8f1a2b3c4_add_agent_token_daily_usage_table.py)

## Overview

- **Priority**: P1 (blocks all other phases)
- **Status**: pending
- **Effort**: 1.5h

Add cost-tracking columns to `agent_token_daily_usage` table. Keep existing token columns for backward compat.

## New Columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `openclaw_cost_total` | NUMERIC(12,6) | 0.0 | Last known cumulative USD cost from OpenClaw |
| `cost_used` | NUMERIC(12,6) | 0.0 | Accumulated USD cost delta for this day |
| `cost_blocked_at` | DateTime, nullable | NULL | When agent hit cost cap |

## Related Code Files

### Files to modify:
- `backend/app/models/agent_token_daily_usage.py` - add 3 new fields

### Files to create:
- `backend/migrations/versions/{next}_add_cost_columns_to_daily_usage.py` - Alembic migration

## Implementation Steps

1. Add fields to `AgentTokenDailyUsage` model:
   ```python
   openclaw_cost_total: float = Field(default=0.0, sa_column=Column(Numeric(12, 6), server_default="0"))
   cost_used: float = Field(default=0.0, sa_column=Column(Numeric(12, 6), server_default="0"))
   cost_blocked_at: datetime | None = None
   ```

2. Generate Alembic migration:
   ```bash
   cd backend && alembic revision --autogenerate -m "add cost columns to agent token daily usage"
   ```

3. Verify migration adds 3 columns with correct types and defaults

4. Verify downgrade drops the 3 columns

## Todo

- [ ] Add `openclaw_cost_total`, `cost_used`, `cost_blocked_at` to model
- [ ] Generate and review Alembic migration
- [ ] Run migration up/down locally
- [ ] Verify model stays under 200 lines

## Success Criteria

- Model has 3 new nullable/defaulted columns
- Migration runs cleanly up and down
- Existing tests still pass (columns are additive with defaults)

## Security Considerations

- No auth changes
- Cost data is internal billing data, not exposed to end users in raw form

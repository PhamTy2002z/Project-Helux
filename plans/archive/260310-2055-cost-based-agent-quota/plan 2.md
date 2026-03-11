---
title: "Cost-Based Agent Quota Enforcement"
description: "Upgrade token quota from flat-multiplier to 2-layer cost+token enforcement using OpenClaw cost data"
status: pending
priority: P1
effort: 10h
branch: develop
tags: [billing, quota, backend, frontend, migration]
created: 2026-03-10
---

# Cost-Based Agent Quota Enforcement

## Summary

Replace flat 0.5x billing multiplier with actual USD cost from OpenClaw. Implement 2-layer quota: cost (primary) + raw token cap (safety net). Backward compatible, additive changes only.

## Architecture

```
OpenClaw sessions.usage response
  |-- totalTokens (raw)         --> token hard-cap (Layer 2 safety net)
  |-- totalCost (USD)           --> cost quota (Layer 1 primary)
  |-- missingCostEntries        --> fallback signal

Enforcement flow:
  1. Parse cost + tokens from OpenClaw
  2. Sync both deltas into daily ledger row
  3. Check cost limit first (primary)
  4. If cost data unavailable (missingCostEntries > 0 && totalCost == 0):
     fall back to token cap only
  5. Check token cap (safety net, always)
```

## Plan Tiers

| Plan | agent_daily_cost | agent_daily_tokens | org_daily_cost | org_daily_tokens |
|------|------------------|--------------------|----------------|------------------|
| trial_7d | $0.50 | 100K | $1.50 | 300K |
| pro | $2.00 | 500K | $10.00 | 1.5M |

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | DB migration + model | pending | 1.5h | [phase-01](phase-01-db-migration-and-model.md) |
| 2 | OpenClaw parser expansion | pending | 1.5h | [phase-02](phase-02-openclaw-parser-expansion.md) |
| 3 | Sync service cost tracking | pending | 2h | [phase-03](phase-03-sync-service-cost-tracking.md) |
| 4 | Enforcement service 2-layer | pending | 2h | [phase-04](phase-04-enforcement-service-two-layer.md) |
| 5 | Entitlement policy + read model | pending | 1.5h | [phase-05](phase-05-entitlement-policy-and-read-model.md) |
| 6 | Frontend cost display | pending | 1h | [phase-06](phase-06-frontend-cost-display.md) |
| 7 | Tests | pending | 1.5h | [phase-07](phase-07-tests.md) |

## Dependencies

- Phase 2, 3 depend on Phase 1 (model columns exist)
- Phase 4 depends on Phase 2, 3 (parser + sync ready)
- Phase 5 depends on Phase 4 (enforcement logic)
- Phase 6 depends on Phase 5 (API fields available)
- Phase 7 runs alongside each phase

## Key Decisions

1. **Keep `billed_tokens_used` column** - backward compat for existing queries; repurpose as raw token tracking (remove 0.5x)
2. **New `cost_usd` column** - NUMERIC(12,6) for precision; tracks accumulated USD cost per agent/day
3. **Fallback logic** - if `missingCostEntries > 0` and `totalCost == 0`, skip cost enforcement, use token cap only
4. **No breaking API changes** - add `cost_*` fields alongside existing `token_*` fields in AgentRead

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| OpenClaw returns 0 cost for valid usage | Fallback to token-only enforcement; log warning |
| Precision loss in float-to-decimal | Use `Decimal` in Python, NUMERIC in Postgres |
| Existing tests rely on 0.5x multiplier | Update test expectations to use raw tokens |

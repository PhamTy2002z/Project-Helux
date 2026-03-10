# Phase 04: API Read Models And Quota Surface Alignment

## Context Links
- [Agent schemas](../../backend/app/schemas/agents.py)
- [Agents API wrapper](../../backend/app/api/agents.py)
- [Agent lifecycle listing](../../backend/app/services/openclaw/provisioning_db.py)
- [Metrics quotas API](../../backend/app/api/metrics.py)

## Overview
- Priority: P1
- Status: Completed
- Goal: expose token usage/remaining on agent read surfaces and align quota snapshot with new ledger.

## Key Insights
- Agents page depends on `AgentRead` from `/api/v1/agents`.
- Current quota snapshot reads stale counters from `organization_plans.metadata`.

## Requirements
- Functional:
  - Add token fields into `AgentRead` payload:
    - `token_used_today`
    - `token_limit_today`
    - `token_remaining_today`
    - `token_blocked`
    - `token_reset_at` (next VN midnight in ISO)
  - Update `/api/v1/metrics/quotas` token resources to use ledger-derived values.
- Non-functional:
  - Backward compatibility for existing clients (new fields optional with defaults).

## Architecture
- During list/get agent:
  - Join/lookup `agent_token_daily_usage` by `agent_id + vn_date`.
  - Get limit from plan policy and derive remaining.
- During entitlement usage build:
  - Compute org/day and org/month from ledger aggregates.
  - Keep fallback for legacy metadata while ledger empty.

## Related Code Files
- Modify:
  - `backend/app/schemas/agents.py`
  - `backend/app/services/openclaw/provisioning_db.py`
  - `backend/app/services/entitlements.py`
  - `backend/app/schemas/entitlements.py`
  - `frontend/src/api/generated/model/agentRead.ts` (regen)
  - `frontend/src/api/generated/model/quotaUsage.ts` (regen if changed)
- Create:
  - `backend/app/services/agent_usage_read_model.py`
- Delete:
  - None

## Implementation Steps
1. Extend backend schema and serializer path for new token fields.
2. Add read-model utility to fetch daily usage row + derived remaining.
3. Refactor entitlement usage builder to aggregate from ledger.
4. Keep compatibility fallback for old rows.
5. Regenerate frontend API types.

## Todo List
- [x] Add token fields to AgentRead.
- [x] Wire list/get agents with usage read model.
- [x] Align `/metrics/quotas` token resources.
- [x] Regenerate API client and fix compile issues.

## Success Criteria
- Agents list/get returns token fields per board-scoped agent.
- Quota summary reflects same numbers as ledger aggregation.
- Existing endpoints remain stable.

## Risk Assessment
- Risk: query overhead on large agent lists.
- Mitigation: batch fetch usage rows by agent ids in one query.

## Security Considerations
- Expose only aggregate numeric fields, no transcript content.

## Next Steps
- Render fields in Agents UI and normalize plan labels in phase 05.

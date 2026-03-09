# Researcher Report: OpenClaw Usage Mechanism

## Scope
- Verify OpenClaw token/cost APIs before planning quota enforcement.
- Verify Mission Control current integration points.

## Findings
- OpenClaw has gateway RPC handlers:
  - `usage.status`
  - `usage.cost`
  - `sessions.usage`
  - `sessions.usage.timeseries`
  - `sessions.usage.logs`
- `sessions.usage` is best source for per-session/per-agent billing math.
  - Returns `sessions[]` entries with `usage.totalTokens`, cost breakdown, message counts, model/provider aggregates.
  - Supports date window with `startDate`, `endDate`.
  - Supports timezone interpretation with `mode` + `utcOffset`.
    - `mode: "specific"`, `utcOffset: "UTC+7"` fits VN reset requirement.
- Mission Control backend currently:
  - Defines `usage.status` and `usage.cost` in method catalog constants.
  - Does NOT call `sessions.usage*` today.
  - Does NOT persist per-agent token usage ledger.
  - Quota usage endpoint (`/api/v1/metrics/quotas`) reads token counters from `organization_plans.metadata.token_usage`, not from runtime session usage.

## Important Code Evidence
- OpenClaw upstream:
  - `src/gateway/server-methods/usage.ts`
  - `src/shared/usage-types.ts`
  - `src/infra/session-cost-usage.types.ts`
- Mission Control:
  - `backend/app/services/openclaw/gateway_rpc.py`
  - `backend/app/services/openclaw/session_service.py`
  - `backend/app/services/openclaw/gateway_dispatch.py`
  - `backend/app/services/entitlements.py`
  - `frontend/src/components/agents/AgentsTable.tsx`

## Gaps vs Target Behavior
- Need new runtime sync flow to map OpenClaw session usage -> Mission Control agent usage.
- Need delta accounting to avoid double-charge on repeated polling.
- Need enforce point before dispatch/send to agent sessions.
- Need API read fields for Agents table token remaining.
- Need label normalization: display `Basic` while keeping internal tier `trial_7d`.

## Risks
- Gateway version drift: old gateways may not support `sessions.usage*`.
- Usage payload can be missing or delayed in transcript-based accounting.
- If enforcement on every send, gateway latency can increase.

## Recommendation
- Use `sessions.usage` as source of truth.
- Keep daily ledger in Mission Control DB keyed by `(agent_id, usage_date_vn)`.
- Compute billed delta with `ceil(delta_openclaw_tokens * 0.5)`.
- Enforce per-agent hard cap before dispatch.
- Keep org-level metrics in sync from same ledger.

## Unresolved Questions
- None blocking for planning.

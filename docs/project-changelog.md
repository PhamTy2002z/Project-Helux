# Project Changelog

## 2026-03-09

### OpenClaw token ledger and per-agent quota surfaces (phase 4-6 first)
- Added token usage read-model for agents API responses with VN-day fields:
  - `token_used_today`
  - `token_limit_today`
  - `token_remaining_today`
  - `token_blocked`
  - `token_reset_at`
- Aligned entitlement quota token metrics with `agent_token_daily_usage` ledger aggregation.
- Kept compatibility fallback to `organization_plans.plan_metadata.token_usage` when ledger has no rows.
- Added frontend plan label mapper to display `Basic` for `trial_7d` while preserving backend tier values.
- Added Agents table `Tokens left` column and blocked badge with reset hint.
- Added backend tests for ledger-derived quota usage + agent token fields and frontend tests for token column and `Basic` label rendering.
- Added structured telemetry logs for usage-sync failures and quota block events.

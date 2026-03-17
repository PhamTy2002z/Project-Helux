# Red Team Report - Board Planning Overlay

## Attack Surface
1. Breaking agent loop by changing task status semantics.
2. Route drift on `/api/v1/agent/boards/{board_id}/tasks`.
3. Event taxonomy drift breaking SSE consumers.
4. Query complexity causing degraded runtime under load.
5. UI virtualization causing drag/drop regression.

## Findings
- Highest risk: hidden semantic drift in agent task discovery defaults.
- High risk: introducing parent execution units that agents may pick incorrectly.
- Medium risk: DB index debt causing p95 latency regression.
- Medium risk: template guidance mismatch with OpenAPI hints.

## Required Countermeasures
- Contract tests for status enum, transition gates, and route defaults.
- Enforce “planning container != execution task” invariant.
- Add index plan + query benchmarks in CI/perf stage.
- Snapshot tests for critical heartbeat template sections.
- Flagged rollout with immediate rollback path.

## Verdict
- Plan acceptable only with contract-first sequencing (phase 01 before all).

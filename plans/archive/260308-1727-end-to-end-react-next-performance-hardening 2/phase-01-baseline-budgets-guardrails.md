---
phase: 1
title: "Baseline, Performance Budgets, and Guardrails"
risk: LOW
effort: 4h
status: completed
---

# Phase 01: Baseline, Performance Budgets, and Guardrails

## Context Links
- [plan.md](./plan.md)
- [scout-report.md](./reports/scout-report.md)
- [frontend/package.json](../../frontend/package.json)

## Overview
- Priority: P1
- Status: completed
- Create measurable baseline and budgets before refactor.

## Key Insights
- Current baseline is broad shared client payload and frequent network churn.
- Without guardrails, regressions will reappear after refactor.

## Requirements
- Functional: generate route-level build stats and set budget thresholds.
- Non-functional: checks must run in local and CI without flaky tooling.

## Architecture
- Add lightweight scripts that parse build artifacts and fail when budgets exceeded.
- Record baseline in docs for comparison per phase.

## Related Code Files
- Modify: `frontend/package.json`, `frontend/next.config.ts`, `docs/code-standards.md`
- Create: `frontend/scripts/perf-budget-check.mjs`, `frontend/scripts/collect-route-bundle-metrics.mjs`
- Delete: none

## Implementation Steps
1. Add script to collect route/chunk metrics from `.next` manifests.
2. Define first budget targets for critical routes.
3. Add `pnpm` command for perf budget check.
4. Document budget policy and update contributor flow.

## Todo List
- [x] Add metrics collection script
- [x] Add budget check script
- [x] Add `perf:check` script in frontend package
- [x] Document baseline and thresholds

## Success Criteria
- `pnpm build && pnpm perf:check` returns deterministic result.
- Budget report available in markdown/json for each run.

## Risk Assessment
- Risk: false positives from evolving Next chunking.
- Mitigation: use tolerant thresholds and delta-based checks.

## Security Considerations
- No auth/data flow change.
- Ensure scripts never read secrets from `.env`.

## Next Steps
- Unlock Phase 2 with measurable baseline.

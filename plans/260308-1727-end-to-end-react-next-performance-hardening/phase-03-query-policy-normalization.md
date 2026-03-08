---
phase: 3
title: "Query Policy Normalization"
risk: MEDIUM
effort: 5h
status: completed
---

# Phase 03: Query Policy Normalization

## Context Links
- [plan.md](./plan.md)
- [Query provider](../../frontend/src/components/providers/QueryProvider.tsx)
- [Dashboard shell](../../frontend/src/components/templates/DashboardShell.tsx)

## Overview
- Priority: P1
- Status: completed
- Replace aggressive global fetch defaults with policy-by-data-class.

## Key Insights
- Current defaults + per-page overrides trigger frequent, duplicated network calls.
- `refetchOnMount: "always"` is overused for mostly stable resources.

## Requirements
- Functional: preserve freshness for volatile data (realtime status, approvals).
- Non-functional: lower request volume and prevent visible UI thrash.

## Architecture
- Introduce query profile map: `static`, `interactive`, `realtime`.
- Centralize defaults and remove ad-hoc per-page policy drift.
- Use visibility-aware polling gates and event-driven invalidation.

## Related Code Files
- Modify: `frontend/src/components/providers/QueryProvider.tsx`, page-level query configs in `frontend/src/app/**`
- Create: `frontend/src/lib/query-policy.ts`
- Delete: none

## Implementation Steps
1. Define query profiles with explicit stale/gc/focus/retry values.
2. Apply profiles to common hooks and high-traffic routes first.
3. Replace mount-always refetch with targeted invalidation.
4. Add a lint/check script to flag anti-patterns.

## Todo List
- [x] Create query profile map
- [x] Migrate dashboard/boards/activity to profiles
- [x] Reduce `refetchOnMount: "always"` usage
- [x] Add anti-pattern guard check

## Success Criteria
- Observable drop in requests per minute on dashboard routes.
- No stale-data incidents in critical operator flows.

## Risk Assessment
- Risk: stale information for operators.
- Mitigation: separate aggressive profile only for realtime-critical paths.

## Security Considerations
- No auth model changes.
- Ensure no sensitive data retained longer than policy.

## Next Steps
- Start route-specific overfetch elimination with new policy baseline.

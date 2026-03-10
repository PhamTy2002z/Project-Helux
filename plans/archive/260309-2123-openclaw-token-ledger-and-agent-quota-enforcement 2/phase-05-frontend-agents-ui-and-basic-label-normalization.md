# Phase 05: Frontend Agents UI And Basic Label Normalization

## Context Links
- [Agents table](../../frontend/src/components/agents/AgentsTable.tsx)
- [Agents page](../../frontend/src/app/(app)/agents/page.tsx)
- [User menu](../../frontend/src/components/organisms/UserMenu.tsx)
- [Dashboard shell](../../frontend/src/components/templates/DashboardShell.tsx)
- [Settings billing section](../../frontend/src/app/(app)/settings/page.tsx)
- [Plan card](../../frontend/src/components/billing/plan-card.tsx)

## Overview
- Priority: P1
- Status: Completed
- Goal: show token remaining in Agents list and unify plan display naming to `Basic`.

## Key Insights
- Multiple screens currently hardcode `Trial 7 days`.
- Agents table already supports sortable columns; easy to add token column + badge.

## Requirements
- Functional:
  - Add token column in Agents list.
  - Display blocked state clearly when remaining is 0.
  - Normalize all `trial_7d` display labels to `Basic`.
- Non-functional:
  - Keep internal tier enum unchanged (`trial_7d`).
  - Preserve responsive table behavior.

## Architecture
- Add shared label mapper in frontend lib:
  - `trial_7d -> Basic`
  - `pro -> Pro`
- Agents table UI:
  - New column `Tokens left` as `remaining / limit`.
  - If blocked: show red pill `Blocked`.
  - For gateway-main or missing data: show `—`.

## Related Code Files
- Modify:
  - `frontend/src/components/agents/AgentsTable.tsx`
  - `frontend/src/components/agents/AgentsTable.test.tsx`
  - `frontend/src/app/(app)/agents/page.tsx`
  - `frontend/src/components/templates/DashboardShell.tsx`
  - `frontend/src/components/organisms/UserMenu.tsx`
  - `frontend/src/components/organisms/UserMenu.test.tsx`
  - `frontend/src/app/(app)/settings/page.tsx`
  - `frontend/src/components/billing/plan-card.tsx`
- Create:
  - `frontend/src/lib/plan-labels.ts`
- Delete:
  - None

## Implementation Steps
1. Add shared `planLabelFromTier` utility.
2. Replace hardcoded trial labels across shell/menu/settings/plan card.
3. Add token column and formatting in AgentsTable.
4. Add blocked visual state and tooltip/reset hint.
5. Update sorting whitelist if token column should sort.
6. Update tests for new labels and table rendering.

## Todo List
- [x] Add shared plan label mapper.
- [x] Normalize `Basic` labels everywhere.
- [x] Add token remaining column + blocked badge.
- [x] Update component tests.

## Success Criteria
- UI shows `Basic` consistently while API value stays `trial_7d`.
- Agents page shows token remaining for board-scoped agents.
- Blocked agents visibly distinguishable.

## Risk Assessment
- Risk: generated model enum mismatch (`free/beta/pro`) in current frontend artifacts.
- Mitigation: regenerate API client from latest backend OpenAPI and remove stale assumptions.

## Security Considerations
- UI must not reveal auth tokens or raw session payloads.

## Next Steps
- Validate full behavior with tests and staged rollout in phase 06.

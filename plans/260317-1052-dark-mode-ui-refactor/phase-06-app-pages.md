# Phase 6: App Pages

## Context Links
- [plan.md](./plan.md) | [phase-02](./phase-02-semantic-status-vars.md)
- All `frontend/src/app/(app)/*/` page files and their sub-components

## Overview
- **Priority:** HIGH
- **Status:** pending
- **Depends on:** Phase 1, Phase 2, Phase 3, Phase 4
- **Description:** Sweep all remaining `(app)` route pages and their domain components. This is the largest phase by file count (~60 files, ~800+ occurrences total).

## Strategy

Every file follows the same replacement table. Instead of listing line-by-line for 60+ files, this phase defines the **universal replacement rules** and the **file inventory** with per-file notes for special cases.

### Universal Replacement Table

| Find | Replace | Notes |
|------|---------|-------|
| `bg-white` | `bg-[color:var(--surface)]` | Card/panel backgrounds |
| `bg-slate-50` | `bg-[color:var(--surface-muted)]` or `bg-app` | `bg-app` for page bg, `surface-muted` for alt rows |
| `bg-slate-100` | `bg-[color:var(--surface-muted)]` | Hover/alt backgrounds |
| `bg-slate-200` | `bg-[color:var(--surface-strong)]` | Stronger alt bg |
| `border-slate-100` | `border-[color:var(--border)]` | |
| `border-slate-200` | `border-[color:var(--border)]` | |
| `border-slate-300` | `border-[color:var(--border-strong)]` | |
| `divide-slate-100` | `divide-[color:var(--border)]` | |
| `divide-slate-200` | `divide-[color:var(--border)]` | |
| `text-slate-900` | `text-strong` | Primary text |
| `text-slate-800` | `text-strong` | Primary text variant |
| `text-slate-700` | `text-[color:var(--text)]` | Body text |
| `text-slate-600` | `text-[color:var(--text-muted)]` | |
| `text-slate-500` | `text-muted` | Secondary text |
| `text-slate-400` | `text-quiet` | Tertiary text |
| `text-slate-300` | `text-quiet` | |
| `hover:bg-slate-50` | `hover:bg-[color:var(--surface-muted)]` | |
| `hover:bg-slate-100` | `hover:bg-[color:var(--surface-muted)]` | |
| `hover:text-slate-700` | `hover:text-[color:var(--text)]` | |
| `hover:text-slate-900` | `hover:text-strong` | |
| `hover:border-slate-300` | `hover:border-[color:var(--border-strong)]` | |
| `focus:border-blue-500` | `focus:border-[color:var(--accent)]` | |
| `focus:ring-blue-500` | `focus:ring-[color:var(--accent)]` | |
| `focus-visible:ring-slate-*` | `focus-visible:ring-[color:var(--accent)]` | |
| `bg-blue-100 text-blue-800` | `bg-[color:var(--accent-soft)] text-[color:var(--accent)]` | Active nav state |
| `bg-blue-50` | `bg-[color:var(--accent-soft)]` or `status-info` context-dependent |
| `border-blue-200` | Use `status-info` utility | |
| `text-blue-600/700/800/900` | `text-[color:var(--accent)]` | |

#### Status banner replacements (use Phase 2 utilities)

| Old Pattern | New | Context |
|-------------|-----|---------|
| `border-emerald-200 bg-emerald-50 text-emerald-700` | `status-success` | Success banners |
| `border-amber-200 bg-amber-50 text-amber-800` | `status-warning` | Warning banners |
| `border-amber-300 bg-amber-50 text-amber-800` | `status-warning` | Warning banners |
| `border-rose-300 bg-rose-50 text-rose-700` | `status-danger` | Error banners |
| `border-blue-100 bg-blue-50 text-blue-800` | `status-info` | Info banners |
| `border-slate-200 bg-slate-50 text-slate-500` | `status-neutral` | Empty/loading states |
| `bg-emerald-100 text-emerald-700` | `status-badge-success` | Status badges |
| `bg-amber-100 text-amber-700` | `status-badge-warning` | Status badges |
| `bg-rose-100 text-rose-700` | `status-badge-danger` | Status badges |
| `bg-blue-100 text-blue-700` | `status-badge-info` | Status badges |
| `bg-slate-100 text-slate-700` | `status-badge-neutral` | Status badges |

#### Gradient replacements

| Old | New |
|-----|-----|
| `bg-gradient-to-br from-slate-50 to-slate-100` | `bg-app` | Simple, no gradient needed |

#### Toggle switch colors (boards edit page)

| Old | New | Notes |
|-----|-----|-------|
| `bg-emerald-600` (toggle on) | keep — vivid indicator | |
| `bg-slate-200` (toggle off) | `bg-[color:var(--surface-strong)]` | |
| `bg-white` (toggle knob) | `bg-[color:var(--text)]` in dark, but better: keep `bg-white` for knob | White knob works in both modes |

## File Inventory

### Group A: Activity (30 hits)

**`frontend/src/app/(app)/activity/page.tsx`**
- Page background: `bg-slate-50` -> `bg-app`
- All card containers, text colors, dividers
- Status badges with hardcoded colors -> `status-badge-*`
- **Special:** ActivityFeed component (`frontend/src/components/activity/ActivityFeed.tsx`, 5 hits) — same replacements

### Group B: Agents (40+ hits across 3 files)

**`frontend/src/app/(app)/agents/page.tsx`** (1 hit — wrapper only)
- `bg-slate-50` -> `bg-app`

**`frontend/src/app/(app)/agents/new/page.tsx`** (20 hits)
- Form containers: `bg-white` -> `bg-[color:var(--surface)]`
- Info banners: `bg-blue-50 border-blue-100` -> `status-info`
- Input borders: `border-slate-300` -> `border-[color:var(--border-strong)]`
- Labels: `text-slate-700` -> `text-[color:var(--text)]`
- Placeholders: `text-slate-400` -> `text-quiet`

**`frontend/src/app/(app)/agents/[agentId]/edit/page.tsx`** (19 hits)
- Same as `new/page.tsx`

**`frontend/src/components/agents/AgentsTable.tsx`** (4 hits)
**`frontend/src/components/agents/template-picker-step.tsx`** (1 hit)
**`frontend/src/components/agents/template-card.tsx`** (7 hits)
**`frontend/src/components/agents/agent-quota-status.tsx`** (19 hits)
- Quota bars: hardcoded `bg-emerald-500`, `bg-amber-500`, `bg-rose-500` -> keep vivid for progress bars
- Text labels: use CSS var equivalents

### Group C: Boards (75+ hits in main page)

**`frontend/src/app/(app)/boards/page.tsx`** (1 hit — wrapper)
**`frontend/src/app/(app)/boards/new/page.tsx`** (13 hits)
**`frontend/src/app/(app)/boards/[boardId]/page.tsx`** (75 hits — HEAVIEST APP PAGE)
- Board detail view with task columns, filters, status indicators
- Same universal replacement table
- **Special:** Keep task status column colors vivid (`bg-blue-500`, `bg-amber-500`, `bg-emerald-500`, `bg-rose-500` for column headers)

**`frontend/src/app/(app)/boards/[boardId]/edit/page.tsx`** (71 hits)
- Complex form with toggles, dropdowns
- Toggle switch: see toggle replacement table above
- `bg-gradient-to-br from-slate-50 to-slate-100` -> `bg-app`

**Board sub-components** (each file, apply universal table):
- `TaskEditDialog.tsx` (24 hits)
- `TaskDetailPanel.tsx` (46 hits)
- `TaskCreateDialog.tsx` (4 hits)
- `TaskDeleteDialog.tsx` (2 hits)
- `TaskCommentCard.tsx` (5 hits)
- `TaskCustomFieldsEditor.tsx` (4 hits)
- `LiveFeedPanel.tsx` (8 hits)
- `LiveFeedCard.tsx` (13 hits)
- `BoardToasts.tsx` (4 hits)
- `AgentsControlDialog.tsx` (3 hits)
- `custom-field-utils.tsx` (1 hit)
- `webhooks/[webhookId]/payloads/page.tsx` (15 hits)

### Group D: Board Groups (81+ hits in detail page)

**`frontend/src/app/(app)/board-groups/page.tsx`** (1 hit)
**`frontend/src/app/(app)/board-groups/new/page.tsx`** (16 hits)
**`frontend/src/app/(app)/board-groups/[groupId]/page.tsx`** (81 hits — SECOND HEAVIEST)
- Board group detail with status badges
- Same universal table + status badge replacements

**`frontend/src/app/(app)/board-groups/[groupId]/edit/page.tsx`** (18 hits)

**`frontend/src/components/board-groups/BoardGroupsTable.tsx`** (4 hits)

### Group E: Approvals

**`frontend/src/app/(app)/approvals/page.tsx`**
- `bg-gradient-to-br from-slate-50 to-slate-100` -> `bg-app`
- Approval status badges -> `status-badge-*`

### Group F: Organization (34 hits)

**`frontend/src/app/(app)/organization/page.tsx`** (34 hits)
- Member/invite tables, role badges
- **Special components:**
  - `MembersInvitesTable.tsx` (10 hits)
  - `BoardAccessTable.tsx` (3 hits)

### Group G: Settings (25 hits)

**`frontend/src/app/(app)/settings/page.tsx`** (25 hits)
- Billing section (already has some dark-aware code)
- **Special components:**
  - `billing/billing-settings-section.tsx` (33 hits)
  - `billing/plan-card.tsx` (6 hits)
  - `billing/quota-summary.tsx` (5 hits)
  - `billing/sidebar-usage-meter.tsx` (3 hits)
  - `billing/upgrade-modal.tsx` (6 hits)
  - `billing/pro-welcome-modal.tsx` (3 hits)

### Group H: Other pages

**`frontend/src/app/(app)/tags/page.tsx`** (1 hit)
**`frontend/src/app/(app)/tags/[tagId]/edit/page.tsx`** (3 hits)
**`frontend/src/components/tags/TagsTable.tsx`** (7 hits)
**`frontend/src/components/tags/TagForm.tsx`** (15 hits)

**`frontend/src/app/(app)/custom-fields/page.tsx`** (1 hit)
**`frontend/src/app/(app)/custom-fields/[fieldId]/edit/page.tsx`** (2 hits)
**`frontend/src/components/custom-fields/CustomFieldsTable.tsx`** (9 hits)
**`frontend/src/components/custom-fields/CustomFieldForm.tsx`** (23 hits)

**`frontend/src/app/(app)/skills/marketplace/page.tsx`** (10 hits)
**`frontend/src/app/(app)/skills/packs/page.tsx`** (1 hit)
**`frontend/src/app/(app)/skills/packs/[packId]/edit/page.tsx`** (3 hits)
**`frontend/src/components/skills/MarketplaceSkillsTable.tsx`** (10 hits)
**`frontend/src/components/skills/MarketplaceSkillForm.tsx`** (7 hits)
**`frontend/src/components/skills/SkillInstallDialog.tsx`** (4 hits)
**`frontend/src/components/skills/SkillPacksTable.tsx`** (5 hits)
**`frontend/src/components/skills/table-helpers.tsx`** (1 hit)

**`frontend/src/app/(app)/gateways/page.tsx`** (1 hit)
**`frontend/src/app/(app)/gateways/[gatewayId]/page.tsx`** (28 hits)
**`frontend/src/components/gateways/GatewaysTable.tsx`** (2 hits)
**`frontend/src/components/gateways/GatewayForm.tsx`** (15 hits)

**`frontend/src/app/(app)/invite/page.tsx`** (8 hits)
**`frontend/src/app/(app)/onboarding/page.tsx`** (7 hits)
**`frontend/src/components/onboarding/onboarding-wizard.tsx`** (34 hits)
**`frontend/src/components/onboarding/getting-started-checklist.tsx`** (6 hits)

**`frontend/src/app/(app)/checkout/success/page.tsx`** (4 hits)

### Group I: Shared components

**`frontend/src/components/tables/DataTable.tsx`** (5 hits)
**`frontend/src/components/tables/cell-formatters.tsx`** (4 hits)
**`frontend/src/components/auth/SignedOutPanel.tsx`** (3 hits)
**`frontend/src/components/auth/AdminOnlyNotice.tsx`** (1 hit)
**`frontend/src/components/BoardOnboardingChat.tsx`** (50 hits)
**`frontend/src/components/BoardChatComposer.tsx`** (12 hits)
**`frontend/src/components/BoardApprovalsPanel.tsx`** (50 hits)
**`frontend/src/components/boards/BoardsTable.tsx`** (3 hits)
**`frontend/src/components/boards/BoardChatThread.tsx`** (15 hits)
**`frontend/src/components/boards/BoardChatSessionList.tsx`** (10 hits)
**`frontend/src/components/boards/BoardChatPanel.tsx`** (13 hits)

### Group J: Loading/misc

**`frontend/src/app/loading.tsx`** (1 hit)

## Execution Order

Process files in this order to minimize risk:
1. Wrapper pages (1-hit files: `boards/page.tsx`, `agents/page.tsx`, etc.)
2. Shared components (DataTable, cell-formatters, auth panels)
3. Domain component tables (AgentsTable, BoardsTable, etc.)
4. Form pages (new/edit pages — moderate complexity)
5. Detail pages (boardId/page.tsx, groupId/page.tsx — highest complexity)
6. Heavy feature components (BoardOnboardingChat, BoardApprovalsPanel, BoardChatThread)

Compile check (`pnpm build`) after each group.

## Todo List

- [ ] Group A: Activity page + ActivityFeed component
- [ ] Group B: Agents pages + agent components
- [ ] Group C: Boards pages + board sub-components (LARGEST)
- [ ] Group D: Board Groups pages + components
- [ ] Group E: Approvals page
- [ ] Group F: Organization page + member/invite tables
- [ ] Group G: Settings page + billing components
- [ ] Group H: Tags, Custom Fields, Skills, Gateways pages + forms
- [ ] Group I: Shared components (DataTable, Chat, Auth, Onboarding)
- [ ] Group J: Loading page
- [ ] Run `pnpm build` after each group — zero errors
- [ ] Full visual spot-check: all pages look identical with `.light`

## Success Criteria
- Zero hardcoded `slate-*`, `white` (as bg), `gray-*` in any `(app)` page file
- Exceptions: vivid status dots/bars (`bg-emerald-500`, `bg-amber-500`, `bg-rose-500`), white toggle knobs
- Build passes
- All pages look identical in light mode

## Risk Assessment
- **HIGH:** This is the largest phase (~60 files, ~800+ changes)
- **Mitigation:** Process in groups with compile checks. Use `replace_all` for universal patterns. Diff review each file.
- **Board detail pages** (75/81 hits) are the riskiest — most complex layouts
- **Chat components** (50 hits each) are isolated and can be deferred if blocking

## Rollback
Revert the commit(s). Since this phase is large, consider splitting into multiple commits (one per group).

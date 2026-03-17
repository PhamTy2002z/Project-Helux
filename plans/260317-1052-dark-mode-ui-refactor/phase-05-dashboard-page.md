# Phase 5: Dashboard Page

## Context Links
- [plan.md](./plan.md) | [phase-02](./phase-02-semantic-status-vars.md)
- `frontend/src/app/(app)/dashboard/page.tsx` (39 hits)
- `frontend/src/app/(app)/dashboard/dashboard-cards.tsx` (18 hits)
- `frontend/src/app/(app)/dashboard/dashboard-utils.ts` (0 hits — pure logic, no UI)

## Overview
- **Priority:** HIGH
- **Status:** pending
- **Depends on:** Phase 1, Phase 2, Phase 4 (DashboardShell/Sidebar already fixed)
- **Description:** Replace all hardcoded colors in the dashboard page and its card components.

## Implementation Steps

### 1. `dashboard-cards.tsx` — TopMetricCard

**File:** `frontend/src/app/(app)/dashboard/dashboard-cards.tsx`

#### 1a. Icon tone mapping (lines 23-30)

The `iconTone` variable maps accent to hardcoded bg+text classes. Replace with `icon-bg-*` utilities from Phase 2:

Before:
```tsx
const iconTone =
  accent === "blue"
    ? "bg-blue-50 text-blue-600"
    : accent === "green"
      ? "bg-emerald-50 text-emerald-600"
      : accent === "violet"
        ? "bg-violet-50 text-violet-600"
        : "bg-green-50 text-green-600";
```

After:
```tsx
const iconTone =
  accent === "blue"
    ? "icon-bg-info"
    : accent === "green"
      ? "icon-bg-success"
      : accent === "violet"
        ? "icon-bg-info"
        : "icon-bg-success";
```

Note: violet maps to info (blue tone in dark mode). Both green variants map to success.

#### 1b. Card container (line 33)
```
Before: "rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
After:  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
```

#### 1c. Title text (line 37)
```
Before: "text-xs font-semibold uppercase tracking-wider text-slate-500"
After:  "text-xs font-semibold uppercase tracking-wider text-muted"
```

#### 1d. Info icon (line 42)
```
Before: "inline-flex text-slate-400"
After:  "inline-flex text-quiet"
```

#### 1e. Value text (line 51)
```
Before: "font-heading text-4xl font-bold text-slate-900"
After:  "font-heading text-4xl font-bold text-strong"
```

#### 1f. Secondary text (line 53)
```
Before: "pb-1 text-xs text-slate-500"
After:  "pb-1 text-xs text-muted"
```

### 2. `dashboard-cards.tsx` — InfoBlock

#### 2a. Card container (line 77)
```
Before: "rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
After:  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
```

#### 2b. Title text (line 80)
```
Before: "text-lg font-semibold text-slate-900"
After:  "text-lg font-semibold text-strong"
```

#### 2c. Info icon (line 83)
```
Before: "inline-flex text-slate-400"
After:  "inline-flex text-quiet"
```

#### 2d. Badge tone mapping (lines 93-98)
```
Before:
  badge.tone === "online"
    ? "bg-emerald-100 text-emerald-700"
    : badge.tone === "offline"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-200 text-slate-700"

After:
  badge.tone === "online"
    ? "status-badge-success"
    : badge.tone === "offline"
      ? "status-badge-danger"
      : "status-badge-neutral"
```

#### 2e. Inner table container (line 105)
```
Before: "divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white"
After:  "divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
```

#### 2f. Row label text (line 108)
```
Before: "min-w-0 text-sm text-slate-500"
After:  "min-w-0 text-sm text-muted"
```

#### 2g. Row value tone mapping (lines 111-117)
```
Before:
  row.tone === "success" ? "text-emerald-700"
    : row.tone === "warning" ? "text-amber-700"
    : row.tone === "danger" ? "text-rose-700"
    : "text-slate-800"

After:
  row.tone === "success" ? "text-status-success"
    : row.tone === "warning" ? "text-status-warning"
    : row.tone === "danger" ? "text-status-danger"
    : "text-strong"
```

### 3. `dashboard/page.tsx` — Main layout

**File:** `frontend/src/app/(app)/dashboard/page.tsx`

#### 3a. Main content area (line 446)
```
Before: "flex-1 overflow-y-auto bg-slate-50"
After:  "flex-1 overflow-y-auto bg-app"
```

#### 3b. Metrics error banner (line 449)
```
Before: "mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700"
After:  "mb-4 rounded-lg status-danger p-3 text-sm"
```

#### 3c. Pending Approvals section container (line 499)
```
Before: "mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
After:  "mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
```

#### 3d. Section title (line 501)
```
Before: "text-lg font-semibold text-slate-900"
After:  "text-lg font-semibold text-strong"
```

#### 3e. Link text (line 504)
```
Before: "inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-700"
After:  "inline-flex items-center gap-1 text-xs text-muted transition hover:text-[color:var(--text)]"
```

#### 3f. Loading state (line 512)
```
Before: "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500"
After:  "rounded-lg status-neutral p-3 text-sm"
```

#### 3g. Error state (line 516)
```
Before: "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
After:  "rounded-lg status-warning p-3 text-sm"
```

#### 3h. Approval list container (line 521)
```
Before: "divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white"
After:  "divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]"
```

#### 3i. Approval item hover (line 526)
```
Before: "flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-slate-50"
After:  "flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-[color:var(--surface-muted)]"
```

#### 3j. Approval item text (lines 528-536)
```
text-slate-700 -> text-[color:var(--text)]
text-slate-800 -> text-strong
text-slate-500 -> text-muted
```

#### 3k. Approval count text (line 543)
```
Before: "text-xs text-slate-500"
After:  "text-xs text-muted"
```

#### 3l. No pending approvals (line 550)
```
Before: "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
After:  "rounded-lg status-success p-3 text-sm"
```

#### 3m. Sessions section (line 557)
```
Before: "min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
After:  "min-w-0 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm"
```

#### 3n. Sessions title + count (lines 559-560)
```
text-lg font-semibold text-slate-900 -> text-lg font-semibold text-strong
text-xs text-slate-500 -> text-xs text-muted
```

#### 3o. "No gateways" / "Loading" empty states (lines 564, 568)
```
Before: "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500"
After:  "rounded-lg status-neutral p-3 text-sm"
```

#### 3p. Gateway unavailable warning (line 574)
```
Before: "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
After:  "rounded-lg status-warning p-3 text-sm"
```

#### 3q. Session cards (line 583)
```
Before: "overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2"
After:  "overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
```

#### 3r. Session card text (lines 587-601)
```
text-sm font-medium text-slate-900 -> text-sm font-medium text-strong
bg-slate-400 -> bg-[color:var(--text-quiet)]
text-xs text-slate-500 -> text-xs text-muted
text-xs font-medium text-slate-700 -> text-xs font-medium text-[color:var(--text)]
text-[11px] text-slate-500 -> text-[11px] text-muted
```

#### 3s. All gateways unavailable (line 612)
```
Before: "rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700"
After:  "rounded-lg status-danger p-3 text-sm"
```

#### 3t. "No active sessions" (line 616)
```
Before: "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500"
After:  "rounded-lg status-neutral p-3 text-sm"
```

#### 3u. Recent Activity section (line 623)
Same pattern as Sessions section — replace container, title, link colors.

#### 3v. Activity event cards (line 650)
```
Before: "cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 focus-visible:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
After:  "cursor-pointer overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 transition hover:border-[color:var(--border-strong)] focus-visible:border-[color:var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
```

#### 3w. Activity event text (lines 654-666)
```
text-sm font-medium text-slate-900 -> text-sm font-medium text-strong
text-xs uppercase tracking-wider text-slate-500 -> text-xs uppercase tracking-wider text-muted
text-[11px] text-slate-500 -> text-[11px] text-muted
```

#### 3x. Empty activity state (line 673)
```
Before: "flex h-[240px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500"
After:  "flex h-[240px] flex-col items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm text-muted"
```

```
Before: "mb-2 h-5 w-5 text-slate-400"
After:  "mb-2 h-5 w-5 text-quiet"
```

```
Before: "mt-1 text-xs text-slate-500"
After:  "mt-1 text-xs text-muted"
```

### 4. Compile check

```bash
cd frontend && pnpm build
```

## Todo List

- [ ] Fix `dashboard-cards.tsx` TopMetricCard — icon tone, card bg, text colors (6 changes)
- [ ] Fix `dashboard-cards.tsx` InfoBlock — badge tones, row tones, containers (7 changes)
- [ ] Fix `dashboard/page.tsx` — main bg (1 change)
- [ ] Fix `dashboard/page.tsx` — error banner (1 change)
- [ ] Fix `dashboard/page.tsx` — Pending Approvals section (8 changes)
- [ ] Fix `dashboard/page.tsx` — Sessions section (10 changes)
- [ ] Fix `dashboard/page.tsx` — Recent Activity section (8 changes)
- [ ] Fix `dashboard/page.tsx` — empty states and status banners (4 changes)
- [ ] Run `pnpm build` — zero errors
- [ ] Visual spot-check: dashboard identical with `.light`, usable without

## Success Criteria
- Zero `slate-*`, `white`, `emerald-*`, `amber-*`, `rose-*`, `blue-*` hardcoded colors remain in dashboard files
- Exception: `bg-emerald-500` status dots (vivid indicators, acceptable)
- Build passes
- Dashboard looks identical in light mode

## Risk Assessment
- **Medium:** `page.tsx` has 39 occurrences — systematic replacement needed
- **Mitigation:** Process section-by-section, compile after each. Use mapping cheatsheet from Phase 2.

## Rollback
Revert the commit. Dashboard files are self-contained.

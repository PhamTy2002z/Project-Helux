# Phase 4: Organisms & Templates

## Context Links
- [plan.md](./plan.md) | [phase-01](./phase-01-css-foundation.md) | [phase-02](./phase-02-semantic-status-vars.md)
- `frontend/src/components/templates/DashboardShell.tsx`
- `frontend/src/components/organisms/DashboardSidebar.tsx`
- `frontend/src/components/organisms/OrgSwitcher.tsx`
- `frontend/src/components/organisms/UserMenu.tsx`
- `frontend/src/components/templates/DashboardPageLayout.tsx`
- `frontend/src/components/templates/dashboard-header-user-info.tsx`

## Overview
- **Priority:** HIGH
- **Status:** pending
- **Depends on:** Phase 1, Phase 2
- **Description:** Fix all hardcoded colors in template and organism components. DashboardSidebar is the heaviest file (51 occurrences).

## Implementation Steps

### 1. `DashboardShell.tsx` (2 changes)

**File:** `frontend/src/components/templates/DashboardShell.tsx`

**Line 23:** Header border + bg
```
Before: "sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm"
After:  "sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)] shadow-sm"
```

**Line 46:** Content area bg
```
Before: "grid h-[calc(100vh-64px)] bg-slate-50 transition-..."
After:  "grid h-[calc(100vh-64px)] bg-app transition-..."
```

### 2. `DashboardSidebar.tsx` (51 occurrences — HEAVIEST)

**File:** `frontend/src/components/organisms/DashboardSidebar.tsx`

#### 2a. Aside container (line 96)
```
Before: "flex h-full flex-col border-r border-slate-200 bg-white transition-..."
After:  "flex h-full flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)] transition-..."
```

#### 2b. Section labels — ALL instances of `text-slate-500` and `text-slate-400`
Apply `replace_all` pattern:
| Find | Replace | Context |
|------|---------|---------|
| `text-slate-500` | `text-muted` | Section headers, labels |
| `text-slate-400` | `text-quiet` | Subsection headers |
| `text-slate-700` | `text-[color:var(--text)]` | Nav item default text |
| `text-slate-900` | `text-strong` | Primary text |

#### 2c. Navigation section label (line 101)
```
Before: "px-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
After:  "px-3 text-xs font-semibold uppercase tracking-wider text-muted"
```

#### 2d. Subsection labels — ALL `text-slate-400` instances (lines 119, 151, 238, 271, 281)
```
Before: "px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
After:  "px-3 text-[11px] font-semibold uppercase tracking-wider text-quiet"
```

#### 2e. Nav link default state — ALL instances (lines 126, 138, 159, 174, 188, 199, 219, 244, 258, 288, 303, 319)
```
Before: "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 transition"
After:  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[color:var(--text-muted)] transition"
```

#### 2f. Nav link active state — ALL instances of `bg-blue-100 text-blue-800 font-medium`
```
Before: "bg-blue-100 text-blue-800 font-medium"
After:  "bg-[color:var(--accent-soft)] text-[color:var(--accent)] font-medium"
```

#### 2g. Nav link hover state — ALL instances of `hover:bg-slate-100`
```
Before: "hover:bg-slate-100"
After:  "hover:bg-[color:var(--surface-muted)]"
```

#### 2h. Locked nav item (line 84)
```
Before: "flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500"
After:  "flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2.5 text-muted"
```

#### 2i. Onboarding banner (line 106)
```
Before: "rounded-lg border border-blue-200 bg-blue-50 p-3"
After:  "rounded-lg status-info p-3"
```
```
Before: "text-xs font-semibold text-blue-900"
After:  "text-xs font-semibold"
```
(color inherited from `.status-info`)
```
Before: "mt-1 text-xs text-blue-800"
After:  "mt-1 text-xs opacity-80"
```

#### 2j. Trial expired banner (line 336)
```
Before: "mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
After:  "mb-3 rounded-lg status-warning p-3"
```
```
Before: "text-xs font-semibold text-amber-900"
After:  "text-xs font-semibold"
```
```
Before: "mt-1 text-xs text-amber-800"
After:  "mt-1 text-xs opacity-80"
```

#### 2k. Footer border (line 334)
```
Before: "shrink-0 border-t border-slate-200 p-4"
After:  "shrink-0 border-t border-[color:var(--border)] p-4"
```

#### 2l. System status text (line 351)
```
Before: "flex items-center gap-2 text-xs text-slate-500"
After:  "flex items-center gap-2 text-xs text-muted"
```

#### 2m. Status dots (lines 355-357)
- `bg-emerald-500` — keep as-is (green dot, works in both modes)
- `bg-rose-500` — keep as-is (red dot, works in both modes)
- `bg-slate-300` → `bg-[color:var(--text-quiet)]`

### 3. `OrgSwitcher.tsx` (8 occurrences)

**File:** `frontend/src/components/organisms/OrgSwitcher.tsx`

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `border-slate-300` | `border-[color:var(--border-strong)]` |
| `text-slate-900` | `text-strong` |
| `text-slate-500` | `text-muted` |
| `text-slate-400` | `text-quiet` |
| `hover:bg-slate-100` | `hover:bg-[color:var(--surface-muted)]` |
| `bg-slate-50` | `bg-[color:var(--surface-muted)]` |

### 4. `UserMenu.tsx` (5 occurrences)

**File:** `frontend/src/components/organisms/UserMenu.tsx`

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `text-slate-900` | `text-strong` |
| `text-slate-500` | `text-muted` |
| `hover:bg-slate-100` | `hover:bg-[color:var(--surface-muted)]` |

### 5. `DashboardPageLayout.tsx` (6 occurrences)

**File:** `frontend/src/components/templates/DashboardPageLayout.tsx`

| Find | Replace |
|------|---------|
| `bg-slate-50` | `bg-app` |
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `text-slate-900` | `text-strong` |
| `text-slate-500` | `text-muted` |
| `text-slate-400` | `text-quiet` |

### 6. `dashboard-header-user-info.tsx` (3 occurrences)

**File:** `frontend/src/components/templates/dashboard-header-user-info.tsx`

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `text-slate-900` | `text-strong` |
| `text-slate-500` | `text-muted` |

### 7. TaskBoard + related organisms

**Files:**
- `frontend/src/components/organisms/TaskBoard.tsx` (17 hits)
- `frontend/src/components/organisms/task-group-column-section.tsx` (15 hits)
- `frontend/src/components/organisms/task-board-filter-bar.tsx` (23 hits)

Apply same replacement patterns:
| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `bg-slate-50` | `bg-[color:var(--surface-muted)]` |
| `bg-slate-100` | `bg-[color:var(--surface-muted)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `border-slate-300` | `border-[color:var(--border-strong)]` |
| `text-slate-900` | `text-strong` |
| `text-slate-800` | `text-strong` |
| `text-slate-700` | `text-[color:var(--text)]` |
| `text-slate-600` | `text-[color:var(--text-muted)]` |
| `text-slate-500` | `text-muted` |
| `text-slate-400` | `text-quiet` |
| `hover:bg-slate-100` | `hover:bg-[color:var(--surface-muted)]` |
| `hover:bg-slate-50` | `hover:bg-[color:var(--surface-muted)]` |
| `divide-slate-100` | `divide-[color:var(--border)]` |
| `divide-slate-200` | `divide-[color:var(--border)]` |
| `focus:border-blue-500` | `focus:border-[color:var(--accent)]` |

### 8. Molecules

**Files:**
- `frontend/src/components/molecules/TaskCard.tsx` (19 hits)
- `frontend/src/components/molecules/DependencyBanner.tsx` (8 hits)

Apply same replacement table as step 7.

### 9. Atoms

**Files:**
- `frontend/src/components/atoms/BrandMark.tsx` (4 hits)
- `frontend/src/components/atoms/Markdown.tsx` (16 hits) — prose/markdown styling
- `frontend/src/components/atoms/StatusDot.tsx` (13 hits) — status indicator colors

For `StatusDot.tsx`: keep explicit color dots (`bg-emerald-500`, `bg-rose-500`, `bg-amber-500`) as they are intentionally vivid indicators. Only replace `bg-slate-*` variants.

For `Markdown.tsx`: replace `text-slate-*` with CSS var equivalents. Prose links and code blocks need dark-aware colors.

### 10. Compile check

```bash
cd frontend && pnpm build
```

## Todo List

- [ ] Fix `DashboardShell.tsx` — header + content area (2 changes)
- [ ] Fix `DashboardSidebar.tsx` — all 51 occurrences
- [ ] Fix `OrgSwitcher.tsx` — 8 occurrences
- [ ] Fix `UserMenu.tsx` — 5 occurrences
- [ ] Fix `DashboardPageLayout.tsx` — 6 occurrences
- [ ] Fix `dashboard-header-user-info.tsx` — 3 occurrences
- [ ] Fix `TaskBoard.tsx` — 17 occurrences
- [ ] Fix `task-group-column-section.tsx` — 15 occurrences
- [ ] Fix `task-board-filter-bar.tsx` — 23 occurrences
- [ ] Fix `TaskCard.tsx` — 19 occurrences
- [ ] Fix `DependencyBanner.tsx` — 8 occurrences
- [ ] Fix `BrandMark.tsx` — 4 occurrences
- [ ] Fix `Markdown.tsx` — 16 occurrences
- [ ] Fix `StatusDot.tsx` — slate variants only
- [ ] Run `pnpm build` — zero errors
- [ ] Visual spot-check with `.light` active — all templates look identical

## Success Criteria
- All template/organism/molecule/atom components use CSS vars only
- No hardcoded `slate-*`, `white`, `gray-*` in these files (except intentional vivid status dots)
- Build passes
- Light mode looks identical

## Risk Assessment
- **Medium:** `DashboardSidebar.tsx` has 51 changes — high chance of a missed or wrong replacement
- **Mitigation:** Use `replace_all` for repetitive patterns. Diff review every file. Compile after each file.
- **Markdown.tsx** prose styling may need fine-tuning for dark mode readability

## Rollback
Revert the commit. These changes are isolated to component files.

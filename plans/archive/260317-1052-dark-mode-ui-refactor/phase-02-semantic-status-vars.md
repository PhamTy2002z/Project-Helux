# Phase 2: Semantic Status Variables

## Context Links
- [plan.md](./plan.md) | [phase-01](./phase-01-css-foundation.md)
- [globals.css](../../frontend/src/app/globals.css)

## Overview
- **Priority:** HIGH - blocks phases 4-6 (pages use status colors heavily)
- **Status:** pending
- **Depends on:** Phase 1
- **Description:** Add CSS variables for semantic status colors (info/success/warning/danger backgrounds and text) that auto-adapt between dark and light mode. Add matching utility classes.

## Key Insights
- Dashboard, activity, board-groups, boards pages all use inline patterns like `bg-emerald-50 text-emerald-700`, `bg-amber-50 text-amber-800`, `bg-rose-50 text-rose-700`, `bg-blue-50 text-blue-600`
- These look good in light mode but will be invisible/clashing in dark mode
- Need ~4 semantic status tones: info (blue), success (green), warning (amber), danger (red)
- Each tone needs: background, text, border
- Also need "neutral" status tone for inactive/unknown states

## Requirements

### Functional
- 5 status tones: `info`, `success`, `warning`, `danger`, `neutral`
- Each tone has 3 tokens: `--status-{tone}-bg`, `--status-{tone}-text`, `--status-{tone}-border`
- Utility classes: `.status-info`, `.status-success`, `.status-warning`, `.status-danger`, `.status-neutral`
- Badge-specific utility: `.status-badge-{tone}` (rounded pill with bg + text + border)

### Non-functional
- Pure CSS, no JS
- Follows existing utility class pattern in `globals.css`

## Implementation Steps

### Step 1: Add status CSS variables to `:root` (dark mode)

Add after existing `--danger` variable in `:root`:

```css
  /* Status semantic tokens — dark */
  --status-info-bg: rgba(59, 130, 246, 0.15);
  --status-info-text: #93C5FD;
  --status-info-border: rgba(59, 130, 246, 0.3);

  --status-success-bg: rgba(34, 197, 94, 0.15);
  --status-success-text: #86EFAC;
  --status-success-border: rgba(34, 197, 94, 0.3);

  --status-warning-bg: rgba(245, 158, 11, 0.15);
  --status-warning-text: #FCD34D;
  --status-warning-border: rgba(245, 158, 11, 0.3);

  --status-danger-bg: rgba(239, 68, 68, 0.15);
  --status-danger-text: #FCA5A5;
  --status-danger-border: rgba(239, 68, 68, 0.3);

  --status-neutral-bg: rgba(168, 162, 158, 0.1);
  --status-neutral-text: #A8A29E;
  --status-neutral-border: rgba(168, 162, 158, 0.2);
```

### Step 2: Add status CSS variables to `.light`

Add after existing `--danger` in `.light`:

```css
  /* Status semantic tokens — light */
  --status-info-bg: #EFF6FF;
  --status-info-text: #1E40AF;
  --status-info-border: #BFDBFE;

  --status-success-bg: #F0FDF4;
  --status-success-text: #166534;
  --status-success-border: #BBF7D0;

  --status-warning-bg: #FFFBEB;
  --status-warning-text: #92400E;
  --status-warning-border: #FDE68A;

  --status-danger-bg: #FEF2F2;
  --status-danger-text: #991B1B;
  --status-danger-border: #FECACA;

  --status-neutral-bg: #F1F5F9;
  --status-neutral-text: #64748B;
  --status-neutral-border: #E2E8F0;
```

### Step 3: Add utility classes in `@layer utilities`

Add inside the existing `@layer utilities { ... }` block:

```css
  /* Status block utilities (for alert/banner/empty-state boxes) */
  .status-info {
    background: var(--status-info-bg);
    color: var(--status-info-text);
    border: 1px solid var(--status-info-border);
  }
  .status-success {
    background: var(--status-success-bg);
    color: var(--status-success-text);
    border: 1px solid var(--status-success-border);
  }
  .status-warning {
    background: var(--status-warning-bg);
    color: var(--status-warning-text);
    border: 1px solid var(--status-warning-border);
  }
  .status-danger {
    background: var(--status-danger-bg);
    color: var(--status-danger-text);
    border: 1px solid var(--status-danger-border);
  }
  .status-neutral {
    background: var(--status-neutral-bg);
    color: var(--status-neutral-text);
    border: 1px solid var(--status-neutral-border);
  }

  /* Status badge utilities (for inline pills/badges) */
  .status-badge-info {
    background: var(--status-info-bg);
    color: var(--status-info-text);
  }
  .status-badge-success {
    background: var(--status-success-bg);
    color: var(--status-success-text);
  }
  .status-badge-warning {
    background: var(--status-warning-bg);
    color: var(--status-warning-text);
  }
  .status-badge-danger {
    background: var(--status-danger-bg);
    color: var(--status-danger-text);
  }
  .status-badge-neutral {
    background: var(--status-neutral-bg);
    color: var(--status-neutral-text);
  }

  /* Status text-only utilities */
  .text-status-info { color: var(--status-info-text); }
  .text-status-success { color: var(--status-success-text); }
  .text-status-warning { color: var(--status-warning-text); }
  .text-status-danger { color: var(--status-danger-text); }
```

### Step 4: Add icon background utilities

For icon containers like `bg-blue-50 text-blue-600`:

```css
  /* Icon container backgrounds */
  .icon-bg-info {
    background: var(--status-info-bg);
    color: var(--status-info-text);
  }
  .icon-bg-success {
    background: var(--status-success-bg);
    color: var(--status-success-text);
  }
  .icon-bg-warning {
    background: var(--status-warning-bg);
    color: var(--status-warning-text);
  }
  .icon-bg-danger {
    background: var(--status-danger-bg);
    color: var(--status-danger-text);
  }
```

### Step 5: Compile check

```bash
cd frontend && pnpm build
```

## Mapping Cheatsheet (for phases 4-6)

This table shows how to replace hardcoded Tailwind classes:

| Old Pattern (light only) | New Utility | Context |
|--------------------------|-------------|---------|
| `bg-blue-50 text-blue-600/700/800` | `icon-bg-info` | Icon containers |
| `bg-emerald-50 text-emerald-600/700` | `icon-bg-success` | Icon containers |
| `bg-violet-50 text-violet-600` | `icon-bg-info` | Icon containers (map violet->info) |
| `bg-green-50 text-green-600` | `icon-bg-success` | Icon containers |
| `border-emerald-200 bg-emerald-50 text-emerald-700` | `status-success rounded-lg` | Banners/alerts |
| `border-amber-200/300 bg-amber-50 text-amber-800/900` | `status-warning rounded-lg` | Banners/alerts |
| `border-rose-300 bg-rose-50 text-rose-700` | `status-danger rounded-lg` | Banners/alerts |
| `border-blue-200 bg-blue-50 text-blue-800/900` | `status-info rounded-lg` | Banners/alerts |
| `border-slate-200 bg-slate-50 text-slate-500` | `status-neutral rounded-lg` | Empty states |
| `bg-emerald-100 text-emerald-700` | `status-badge-success` | Badges |
| `bg-rose-100 text-rose-700` | `status-badge-danger` | Badges |
| `bg-slate-200 text-slate-700` | `status-badge-neutral` | Badges |
| `text-emerald-700` | `text-status-success` | Inline text |
| `text-amber-700` | `text-status-warning` | Inline text |
| `text-rose-700` | `text-status-danger` | Inline text |

## Todo List

- [ ] Add status vars to `:root` (dark)
- [ ] Add status vars to `.light`
- [ ] Add `.status-{tone}` block utilities
- [ ] Add `.status-badge-{tone}` badge utilities
- [ ] Add `.text-status-{tone}` text utilities
- [ ] Add `.icon-bg-{tone}` icon container utilities
- [ ] Run `pnpm build` — zero errors
- [ ] Visual spot-check: no change with `.light` class active

## Success Criteria
- All status utilities defined and available
- Build passes
- With `.light` class active, no visual change

## Risk Assessment
- **Low risk:** Additive-only change (new CSS classes, no modifications to existing)
- **Mitigation:** If any color doesn't work, adjust the hex/rgba values

## Rollback
Remove the added CSS variables and utility classes.

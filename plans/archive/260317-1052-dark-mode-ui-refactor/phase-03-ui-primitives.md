# Phase 3: UI Primitives

## Context Links
- [plan.md](./plan.md) | [phase-01](./phase-01-css-foundation.md)
- UI files: `frontend/src/components/ui/*.tsx`

## Overview
- **Priority:** HIGH
- **Status:** pending
- **Depends on:** Phase 1
- **Description:** Audit and fix all `src/components/ui/*.tsx` files. Most already use CSS vars — only a few have hardcoded Tailwind colors.

## Key Insights
- **Already good (no changes needed):** `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `tabs.tsx`, `badge.tsx`, `textarea.tsx`, `dialog.tsx` (content/header/footer/title/description)
- **Needs fix:** `skeleton.tsx`, `tooltip.tsx`, `dialog.tsx` (overlay only), `dropdown-select.tsx`, `searchable-select.tsx`, `table-state.tsx`, `command.tsx`, `global-loader.tsx`, `confirm-action-dialog.tsx`, `popover.tsx`

## Implementation Steps

### 1. `skeleton.tsx` (1 change)

**File:** `frontend/src/components/ui/skeleton.tsx`

**Line 6:** Replace `bg-slate-200` with `bg-[color:var(--surface-strong)]`

Before:
```tsx
className={cn("animate-pulse rounded-md bg-slate-200", className)}
```
After:
```tsx
className={cn("animate-pulse rounded-md bg-[color:var(--surface-strong)]", className)}
```

### 2. `tooltip.tsx` (1 change)

**File:** `frontend/src/components/ui/tooltip.tsx`

**Line 20:** `bg-slate-900` works acceptably in both modes (dark tooltip on light bg, slightly lighter tooltip on dark bg). However, for consistency:

Before:
```tsx
"rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg"
```
After:
```tsx
"rounded-lg bg-[color:var(--text)] px-3 py-2 text-xs font-semibold text-[color:var(--bg)] shadow-lg"
```

This gives dark tooltip on light bg and light tooltip on dark bg — inverted from the content, which is the standard tooltip pattern.

### 3. `dialog.tsx` — overlay (1 change)

**File:** `frontend/src/components/ui/dialog.tsx`

**Line 20:** `bg-slate-950/40` — this is an overlay. For dark mode, keep similar darkness:

Before:
```tsx
"fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] ..."
```
After:
```tsx
"fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] ..."
```

`bg-black/50` works well in both modes (dark overlay).

### 4. `dropdown-select.tsx`

**File:** `frontend/src/components/ui/dropdown-select.tsx`

Grep for hardcoded colors and replace:

| Find | Replace | Context |
|------|---------|---------|
| `bg-white` | `bg-[color:var(--surface)]` | Dropdown panel |
| `border-slate-200` | `border-[color:var(--border)]` | Borders |
| `border-slate-300` | `border-[color:var(--border-strong)]` | Trigger border |
| `text-slate-900` | `text-strong` | Primary text |
| `text-slate-500` | `text-muted` | Secondary text |
| `text-slate-400` | `text-quiet` | Placeholder |
| `hover:bg-slate-100` | `hover:bg-[color:var(--surface-muted)]` | Hover states |
| `bg-slate-50` | `bg-[color:var(--surface-muted)]` | Alt backgrounds |

### 5. `searchable-select.tsx`

**File:** `frontend/src/components/ui/searchable-select.tsx`

Same pattern as dropdown-select:

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-*` | `border-[color:var(--border)]` or `border-[color:var(--border-strong)]` |

### 6. `table-state.tsx`

**File:** `frontend/src/components/ui/table-state.tsx`

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `text-slate-500` | `text-muted` |
| `text-slate-900` | `text-strong` |

### 7. `command.tsx`

**File:** `frontend/src/components/ui/command.tsx`

| Find | Replace |
|------|---------|
| `bg-white` | `bg-[color:var(--surface)]` |
| `border-slate-200` | `border-[color:var(--border)]` |
| `text-slate-500` | `text-muted` |

### 8. `global-loader.tsx`

**File:** `frontend/src/components/ui/global-loader.tsx`

Check for hardcoded colors — typically spinner/loading states. Replace any `bg-slate-*` or `text-slate-*` with CSS var equivalents.

### 9. `confirm-action-dialog.tsx`

**File:** `frontend/src/components/ui/confirm-action-dialog.tsx`

Likely uses Dialog internally. Check for any additional hardcoded colors in the confirm-specific parts (destructive button colors etc.).

### 10. `popover.tsx`

**File:** `frontend/src/components/ui/popover.tsx`

Check popover content panel for `bg-white` / `border-slate-*` and replace with var equivalents.

### 11. Compile check

```bash
cd frontend && pnpm build
```

## Verification Pattern

For each file, after changes:
1. Ensure `pnpm build` passes
2. With `.light` class active on `<html>`, component should look identical to before
3. Remove `.light` class temporarily — component should render with dark colors (may look odd until pages are updated, but no broken layout)

## Todo List

- [ ] Fix `skeleton.tsx` — `bg-slate-200` -> `var(--surface-strong)`
- [ ] Fix `tooltip.tsx` — `bg-slate-900` -> `var(--text)`, text -> `var(--bg)`
- [ ] Fix `dialog.tsx` overlay — `bg-slate-950/40` -> `bg-black/50`
- [ ] Fix `dropdown-select.tsx` — all hardcoded colors
- [ ] Fix `searchable-select.tsx` — all hardcoded colors
- [ ] Fix `table-state.tsx` — all hardcoded colors
- [ ] Fix `command.tsx` — all hardcoded colors
- [ ] Fix `global-loader.tsx` — check and fix
- [ ] Fix `confirm-action-dialog.tsx` — check and fix
- [ ] Fix `popover.tsx` — check and fix
- [ ] Run `pnpm build` — zero errors
- [ ] Visual spot-check with `.light` active

## Success Criteria
- All `src/components/ui/*.tsx` files use CSS vars or theme-aware utilities only
- Zero hardcoded `slate-*`, `white`, `gray-*` classes remain in `ui/` directory
- Build passes

## Risk Assessment
- **Low:** Most files already use CSS vars. Changes are mechanical find-replace.
- **Tooltip inversion** is a design choice — if team prefers dark tooltip in both modes, use `bg-gray-900 text-white` (works in both).

## Rollback
Revert the commit. UI primitives are independent — no cascade.

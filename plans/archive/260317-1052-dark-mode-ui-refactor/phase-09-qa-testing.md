# Phase 9: QA & Testing

## Context Links
- [plan.md](./plan.md)
- All previous phases

## Overview
- **Priority:** MEDIUM
- **Status:** pending
- **Depends on:** All phases 1-8 complete
- **Description:** Systematic verification that dark and light modes render correctly across all pages, meet contrast requirements, and pass existing tests.

## Verification Checklist

### 1. Build & Lint

- [ ] `cd frontend && pnpm build` — zero errors
- [ ] `cd frontend && pnpm lint` — zero new warnings from color changes
- [ ] No TypeScript errors from new files (theme-provider, ThemeToggle, chart-theme)

### 2. Existing Tests

- [ ] `cd frontend && pnpm test` — all existing tests pass
- [ ] Specifically check: `UserMenu.test.tsx`, `TaskBoard.test.tsx`, `LocalAuthLogin.test.tsx`, `task-board-overlay.test.tsx`
- [ ] Tests should not assert specific color classes (if they do, update assertions)

### 3. Hardcoded Color Audit

Run grep to confirm zero remaining hardcoded colors in app files:

```bash
cd frontend && grep -rn --include="*.tsx" \
  -e "bg-white" -e "bg-slate-" -e "text-slate-" -e "border-slate-" \
  -e "divide-slate-" -e "bg-gray-" -e "text-gray-" \
  src/app/\(app\)/ src/components/ \
  | grep -v "node_modules" \
  | grep -v "landing"
```

**Expected exceptions (OK to keep):**
- `bg-emerald-500`, `bg-rose-500`, `bg-amber-500` — vivid status dots/progress bars
- `bg-white` on toggle knobs
- `bg-slate-900` / `bg-black` on tooltips/overlays
- `bg-emerald-600` on toggle "on" state
- Landing page components (out of scope)

### 4. Visual Regression — Dark Mode

Check each page in dark mode (no `.light` class):

| Page | Check |
|------|-------|
| `/dashboard` | Cards readable, status badges visible, activity cards contrast |
| `/activity` | Event cards, status badges, timestamps legible |
| `/boards` | Board list table, hover states |
| `/boards/[id]` | Task columns, task cards, filter bar, detail panel, chat |
| `/boards/[id]/edit` | Form inputs, toggles, dropdowns |
| `/boards/new` | Form containers, info banners |
| `/board-groups` | Table, status badges |
| `/board-groups/[id]` | Detail view, board cards, status indicators |
| `/agents` | Agent table, quota bars |
| `/agents/new` | Form, template picker |
| `/approvals` | Approval cards, status badges |
| `/organization` | Member table, invite table, role badges |
| `/settings` | Billing cards, plan cards, usage meters |
| `/tags` | Tags table |
| `/custom-fields` | Fields table, form |
| `/skills/marketplace` | Skills table, install dialog |
| `/onboarding` | Wizard steps, checklist |

### 5. Visual Regression — Light Mode

Toggle to light mode and verify same pages look identical to pre-refactor.

### 6. Contrast Check

For dark mode, verify WCAG AA compliance (4.5:1 for normal text):

| Element | Foreground | Background | Expected Ratio |
|---------|-----------|------------|----------------|
| Body text | `#F8FAFC` | `#14120B` | ~17:1 |
| Muted text | `#A8A29E` | `#14120B` | ~7.5:1 |
| Quiet text | `#78716C` | `#14120B` | ~4.5:1 |
| Muted on surface | `#A8A29E` | `#1D1B15` | ~6.8:1 |
| Accent on bg | `#3B82F6` | `#14120B` | ~5.5:1 |
| Status success text | `#86EFAC` | status-success-bg | verify >= 4.5:1 |
| Status warning text | `#FCD34D` | status-warning-bg | verify >= 4.5:1 |
| Status danger text | `#FCA5A5` | status-danger-bg | verify >= 4.5:1 |

Use browser DevTools or https://webaim.org/resources/contrastchecker/

### 7. Theme Toggle UX

- [ ] Toggle dark -> light: smooth transition, no flash
- [ ] Toggle light -> dark: smooth transition, no flash
- [ ] Refresh page in light mode: stays light (localStorage persisted)
- [ ] Refresh page in dark mode: stays dark
- [ ] Clear localStorage, set system to light: page loads light
- [ ] Clear localStorage, set system to dark: page loads dark
- [ ] Incognito window (no localStorage): respects system preference
- [ ] Toggle updates immediately (no page reload needed)

### 8. Responsive Check

In both modes, verify at breakpoints:
- [ ] 375px (mobile)
- [ ] 768px (tablet)
- [ ] 1024px (laptop)
- [ ] 1440px (desktop)
- [ ] 1920px (FHD)

### 9. Edge Cases

- [ ] Sidebar collapsed: dark bg visible, no white gaps
- [ ] Dialog/modal open: overlay darkens correctly, dialog content readable
- [ ] Dropdown/select open: popover panel has correct dark bg
- [ ] Tooltip hover: tooltip contrasts with both modes
- [ ] Skeleton loading states: visible in dark mode
- [ ] Empty states: neutral banners visible in dark mode
- [ ] Error states: danger banners visible in dark mode
- [ ] Charts: grid lines, labels, tooltips readable in dark mode
- [ ] Markdown content in chat/comments: code blocks, links readable

### 10. Performance Budget

- [ ] Run `cd frontend && pnpm build && pnpm perf:collect`
- [ ] Run `cd frontend && pnpm perf:check` — verify no budget regression
- [ ] Theme toggle does not cause layout shift (CLS = 0)
- [ ] New CSS adds < 2KB to stylesheet size

## Todo List

- [ ] Build & lint pass
- [ ] All existing tests pass
- [ ] Hardcoded color audit — no violations
- [ ] Dark mode visual check — all pages
- [ ] Light mode visual check — all pages identical to pre-refactor
- [ ] Contrast ratios verified (WCAG AA)
- [ ] Theme toggle UX verified
- [ ] Responsive check at all breakpoints
- [ ] Edge cases verified
- [ ] Performance budget check passes

## Success Criteria
- All checks above pass
- Zero visual regressions in light mode
- Dark mode is usable and meets WCAG AA contrast
- Existing test suite passes without modification (or with minimal assertion updates)
- Performance budget maintained

## Risk Assessment
- **Test assertion failures** if tests check for specific Tailwind classes like `bg-white` — update assertions
- **Chat components** (50 hits each) may have subtle dark mode issues — test chat thoroughly
- **Third-party components** (Radix UI) may inject inline styles — verify popover/dialog/select panels

## Rollback
If QA reveals widespread issues, revert all phase commits. The `.light` class on `<html>` serves as emergency fallback at any point during migration.

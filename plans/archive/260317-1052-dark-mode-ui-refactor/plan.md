---
title: "Dark Mode UI Refactor"
description: "Refactor FlowGrid dashboard from light-only to dark-default with light toggle via CSS variable swap"
status: pending
priority: P1
effort: 16h
branch: develop
tags: [ui, dark-mode, css, refactor, frontend]
created: 2026-03-17
---

# Dark Mode UI Refactor

## Summary

Convert FlowGrid's frontend from light-only to dark-default with light toggle. Strategy: CSS variable swap (`":root"` = dark, `.light` on `<html>` = light override). Replace all ~1356 hardcoded Tailwind color classes across ~121 `.tsx` files with CSS variable utilities.

## Scope

- **In scope:** All `(app)` route pages, all `components/` (ui, atoms, molecules, organisms, templates), theme toggle, charts
- **Out of scope (Phase 2):** Landing page (`(public)` routes), `landing-enterprise` CSS, `landing-slideshow` CSS

## Design System

| Token | Dark (default) | Light (`.light`) |
|-------|---------------|-----------------|
| `--bg` | `#14120B` | `#f8fafc` |
| `--surface` | `#1D1B15` | `#ffffff` |
| `--surface-muted` | `#252319` | `#f1f5f9` |
| `--surface-strong` | `#2E2C22` | `#e2e8f0` |
| `--border` | `#2E2C22` | `#e2e8f0` |
| `--border-strong` | `#3D3A2F` | `#cbd5e1` |
| `--text` | `#F8FAFC` | `#0f172a` |
| `--text-muted` | `#A8A29E` | `#64748b` |
| `--text-quiet` | `#78716C` | `#94a3b8` |
| `--accent` | `#3B82F6` | `#2563eb` |
| `--accent-strong` | `#60A5FA` | `#1d4ed8` |
| `--accent-soft` | `rgba(59,130,246,0.15)` | `rgba(37,99,235,0.12)` |
| `--success` | `#22C55E` | `#16a34a` |
| `--warning` | `#F59E0B` | `#d97706` |
| `--danger` | `#EF4444` | `#dc2626` |

## Phases

| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 1 | CSS Foundation | [phase-01-css-foundation.md](./phase-01-css-foundation.md) | 2h | pending |
| 2 | Semantic Status Variables | [phase-02-semantic-status-vars.md](./phase-02-semantic-status-vars.md) | 1h | pending |
| 3 | UI Primitives | [phase-03-ui-primitives.md](./phase-03-ui-primitives.md) | 2h | pending |
| 4 | Organisms & Templates | [phase-04-organisms-templates.md](./phase-04-organisms-templates.md) | 2h | pending |
| 5 | Dashboard Page | [phase-05-dashboard-page.md](./phase-05-dashboard-page.md) | 2h | pending |
| 6 | App Pages | [phase-06-app-pages.md](./phase-06-app-pages.md) | 3h | pending |
| 7 | Theme Toggle | [phase-07-theme-toggle.md](./phase-07-theme-toggle.md) | 2h | pending |
| 8 | Charts & Data Viz | [phase-08-charts-data-viz.md](./phase-08-charts-data-viz.md) | 1h | pending |
| 9 | QA & Testing | [phase-09-qa-testing.md](./phase-09-qa-testing.md) | 1h | pending |

## Key Dependencies

- Phase 1 blocks all other phases (CSS vars must exist first)
- Phase 2 blocks phases 4-6 (status vars used in pages)
- Phase 7 (toggle) can run in parallel with phases 4-6
- Phase 8 (charts) depends on Phase 1 only
- Phase 9 runs last

## Rollback Strategy

Each phase is a separate commit. If dark mode causes issues:
1. Revert phase commits in reverse order
2. Or: add `.light` class to `<html>` as emergency fallback (renders existing light mode)

## Key Observations from Audit

1. **UI primitives already use CSS vars** - `button.tsx`, `card.tsx`, `input.tsx`, `select.tsx`, `tabs.tsx`, `badge.tsx`, `textarea.tsx`, `dialog.tsx` already use `var(--*)` tokens. Minimal changes needed.
2. **Heaviest files** - `DashboardSidebar.tsx` (51 hits), `dashboard/page.tsx` (39 hits), `boards/[boardId]/page.tsx` (75 hits), `board-groups/[groupId]/page.tsx` (81 hits)
3. **Semantic status colors** - Many pages use inline `bg-emerald-50 text-emerald-700`, `bg-amber-50 text-amber-800`, etc. Need CSS variable approach for dark mode.
4. **Tooltip** - Only UI primitive still using hardcoded `bg-slate-900` (acceptable for tooltip background, works in both modes)
5. **Skeleton** - Uses `bg-slate-200`, needs `var(--surface-strong)`
6. **Dialog overlay** - `bg-slate-950/40` works for both modes

## Validation Decisions (2026-03-17)

| Question | Decision |
|----------|----------|
| UI breakage during refactor | Accepted — UI will temporarily break between phases |
| Landing page | Out of scope — keep as-is |
| Theme toggle location | Header → UserMenu dropdown |
| Status badge approach | CSS variables (`--status-*-bg`, `--status-*-text`) |
| Chart colors | CSS vars via `getChartColors()` — auto-adapt on toggle |
| System preference | Respect OS `prefers-color-scheme` + dark fallback |
| Default theme | Dark (`:root` = dark, `.light` = light override) |
| Font change | Inter for ALL (body, heading, display) — drop IBM Plex Sans, Sora, DM Serif Display |

# Planner Report: Dark Mode UI Refactor

## Summary

Created comprehensive 9-phase implementation plan for converting FlowGrid's dashboard from light-only to dark-default with light toggle.

## Plan Location

`D:\projects\Project-FlowGrid\plans\260317-1052-dark-mode-ui-refactor\`

## Scope

- **1356 hardcoded color occurrences** across **121 .tsx files**
- Strategy: CSS variable swap (`:root` = dark default, `.light` class = light override)
- All `(app)` routes and components in scope; landing pages deferred to Phase 2

## Phase Summary

| # | Phase | Effort | Risk | Key Files |
|---|-------|--------|------|-----------|
| 1 | CSS Foundation | 2h | Low | globals.css, layout.tsx |
| 2 | Semantic Status Vars | 1h | Low | globals.css (additive) |
| 3 | UI Primitives | 2h | Low | 10 files in components/ui/ |
| 4 | Organisms & Templates | 2h | Med | DashboardSidebar (51 hits), TaskBoard, OrgSwitcher |
| 5 | Dashboard Page | 2h | Med | page.tsx (39), dashboard-cards.tsx (18) |
| 6 | App Pages | 3h | High | ~60 files, ~800+ changes |
| 7 | Theme Toggle | 2h | Low | New: theme-provider.tsx, ThemeToggle.tsx |
| 8 | Charts & Data Viz | 1h | Low | 2 chart files |
| 9 | QA & Testing | 1h | Med | All pages visual + contrast check |

**Total estimated effort: 16h**

## Key Findings from Audit

1. **UI primitives already use CSS vars** — button, card, input, select, tabs, badge, textarea, dialog all use `var(--*)`. Minimal Phase 3 work.
2. **Heaviest files:** `boards/[boardId]/page.tsx` (75 hits), `board-groups/[groupId]/page.tsx` (81 hits), `DashboardSidebar.tsx` (51 hits), `BoardOnboardingChat.tsx` (50 hits), `BoardApprovalsPanel.tsx` (50 hits)
3. **Existing utility classes** (`bg-app`, `surface-card`, `text-strong`, `text-muted`, etc.) already work with CSS vars — heavily leveraged in the plan.
4. **Emergency rollback:** At any point, adding `.light` class to `<html>` restores current light appearance.

## Design Decisions

- Dark palette uses warm undertone (#14120B base) for comfortable reading
- Status colors use semi-transparent backgrounds in dark mode (rgba) for depth
- Tooltip inverts (uses `--text` bg, `--bg` text) for contrast in both modes
- Theme toggle uses blocking inline script to prevent FOUC
- Vivid status dots/progress bars (`bg-emerald-500`, `bg-rose-500`) kept as-is — work in both modes

## Unresolved Questions

1. **Violet accent:** Dashboard uses `bg-violet-50 text-violet-600` for error rate icon. Mapped to `icon-bg-info` (blue). Team may want a separate violet status tone.
2. **Landing page timing:** When should the landing page be converted? Separate plan recommended.
3. **Chat markdown rendering:** `Markdown.tsx` has 16 hits — prose styling in dark mode may need fine-tuning beyond simple color replacement (code blocks, links, blockquotes).

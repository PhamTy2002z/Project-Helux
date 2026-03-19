# Phase 8: Charts & Data Viz

## Context Links
- [plan.md](./plan.md) | [phase-01](./phase-01-css-foundation.md)
- `frontend/src/components/charts/chart.tsx` (1 hit)
- `frontend/src/components/charts/metric-sparkline.tsx` (1 hit)

## Overview
- **Priority:** LOW
- **Status:** pending
- **Depends on:** Phase 1, Phase 7 (needs theme context for dynamic colors)
- **Description:** Make Recharts components theme-aware so chart colors, grid lines, axis labels, and tooltips adapt to dark/light mode.

## Key Insights
- FlowGrid uses Recharts for data visualization
- Charts currently have minimal hardcoded colors (only 1 hit per chart file)
- Recharts accepts color props directly — need to read CSS vars at runtime
- Chart tooltip needs dark-aware styling
- Grid lines and axis text must contrast with dark background

## Implementation Steps

### Step 1: Create chart theme utility

**File:** `frontend/src/components/charts/chart-theme.ts`

```ts
/**
 * Returns resolved CSS variable values for chart theming.
 * Call inside a component or effect — requires DOM access.
 */
export function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--text-muted").trim(),
    textStrong: style.getPropertyValue("--text").trim(),
    grid: style.getPropertyValue("--border").trim(),
    surface: style.getPropertyValue("--surface").trim(),
    border: style.getPropertyValue("--border").trim(),
    accent: style.getPropertyValue("--accent").trim(),
    accentStrong: style.getPropertyValue("--accent-strong").trim(),
    success: style.getPropertyValue("--success").trim(),
    warning: style.getPropertyValue("--warning").trim(),
    danger: style.getPropertyValue("--danger").trim(),
  };
}

/** Static series palette — works in both modes (vivid mid-range colors) */
export const SERIES_COLORS = [
  "#3B82F6", // blue-500
  "#22C55E", // green-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#EC4899", // pink-500
  "#F97316", // orange-500
];
```

### Step 2: Update `chart.tsx`

**File:** `frontend/src/components/charts/chart.tsx`

Read the file to identify exact Recharts usage, then:

- Replace any hardcoded `stroke`, `fill` colors with `getChartColors()` values
- Style `<CartesianGrid>` with `stroke={colors.grid}`
- Style `<XAxis>` / `<YAxis>` tick with `fill={colors.text}`
- Style `<Tooltip>` with:
  ```tsx
  contentStyle={{
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.textStrong,
  }}
  ```

Pattern:
```tsx
const colors = useMemo(() => getChartColors(), [theme]);
```

Where `theme` comes from `useTheme()` — triggers re-resolve when user toggles.

### Step 3: Update `metric-sparkline.tsx`

**File:** `frontend/src/components/charts/metric-sparkline.tsx`

Same approach — resolve CSS vars for line color, area fill, tooltip.

Replace any `text-slate-*` in the component wrapper with CSS var equivalents.

### Step 4: Compile check

```bash
cd frontend && pnpm build
```

## Todo List

- [ ] Create `frontend/src/components/charts/chart-theme.ts`
- [ ] Update `chart.tsx` — use `getChartColors()` for all color props
- [ ] Update `metric-sparkline.tsx` — use `getChartColors()` for all color props
- [ ] Replace any hardcoded `text-slate-*` in chart wrapper divs
- [ ] Run `pnpm build` — zero errors
- [ ] Visual check: charts readable in dark mode (grid lines visible, text legible)

## Success Criteria
- Charts render correctly in both dark and light mode
- Grid lines, axis labels, tooltips all contrast properly
- Series colors remain vivid in both modes
- Build passes

## Risk Assessment
- **Low:** Only 2 chart files with 1 hit each
- **Recharts tooltip** may need `wrapperClassName` for additional dark styling
- **`getComputedStyle`** only works client-side — guard with typeof check

## Rollback
Revert the commit. Charts revert to hardcoded light-mode colors (still functional, just not dark-optimized).

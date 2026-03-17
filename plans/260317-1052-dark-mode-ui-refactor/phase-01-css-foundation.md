# Phase 1: CSS Foundation

## Context Links
- [plan.md](./plan.md)
- [globals.css](../../frontend/src/app/globals.css)
- [tailwind.config.cjs](../../frontend/tailwind.config.cjs)
- [layout.tsx](../../frontend/src/app/layout.tsx)

## Overview
- **Priority:** CRITICAL - blocks all other phases
- **Status:** pending
- **Description:** Restructure `globals.css` so `:root` = dark mode (default), `.light` class = light override. Update Tailwind config. Add no-flash script.

## Key Insights
- Current `:root` has light-mode values — these move to `.light` class
- Dark values become the new `:root`
- `color-scheme` CSS property must flip per theme
- `tailwind.config.cjs` already has `darkMode: ["class"]` — keep it but we won't use Tailwind's `dark:` prefix; we use CSS var swap instead
- Landing page CSS (`.landing-enterprise`, `.hero-*`, `.landing-slideshow`) is untouched in this phase

## Requirements

### Functional
- `:root` contains dark mode CSS variables
- `.light` class on `<html>` activates light mode variables
- `color-scheme` property set correctly per theme
- No visual change in light mode when `.light` class applied
- Body/html defaults work with dark bg

### Non-functional
- Zero runtime JS for variable swap (pure CSS)
- No flash of wrong theme on page load

## Architecture

```
globals.css
  :root { /* dark values */ }
  .light { /* light overrides */ }

layout.tsx
  <html> gets class from cookie/localStorage (handled in Phase 7)
  For now: <html class="light"> to preserve current look during migration
```

## Related Code Files

### Files to modify
- `frontend/src/app/globals.css` — restructure `:root` + add `.light`
- `frontend/src/app/layout.tsx` — add `className="light"` temporarily

### Files NOT to touch
- `tailwind.config.cjs` — already correct (`darkMode: ["class"]`)

## Implementation Steps

### Step 1: Restructure `:root` in `globals.css`

Replace lines 5-26 (current `:root`) with:

```css
:root {
  color-scheme: dark;
  --bg: #14120B;
  --surface: #1D1B15;
  --surface-muted: #252319;
  --surface-strong: #2E2C22;
  --border: #2E2C22;
  --border-strong: #3D3A2F;
  --text: #F8FAFC;
  --text-muted: #A8A29E;
  --text-quiet: #78716C;
  --accent: #3B82F6;
  --accent-strong: #60A5FA;
  --accent-soft: rgba(59, 130, 246, 0.15);
  --success: #22C55E;
  --warning: #F59E0B;
  --danger: #EF4444;
  --shadow-panel: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-card: 0 0 0 1px #2E2C22;
}
```

### Step 2: Add `.light` class block after `:root`

```css
.light {
  color-scheme: light;
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-muted: #f1f5f9;
  --surface-strong: #e2e8f0;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text: #0f172a;
  --text-muted: #64748b;
  --text-quiet: #94a3b8;
  --accent: #2563eb;
  --accent-strong: #1d4ed8;
  --accent-soft: rgba(37, 99, 235, 0.12);
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --shadow-panel:
    0 1px 3px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.08);
  --shadow-card:
    0 1px 2px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.06);
}
```

### Step 3: Temporarily add `.light` to `<html>` in `layout.tsx`

In `layout.tsx` line 99, change:
```tsx
<html lang="en">
```
to:
```tsx
<html lang="en" className="light">
```

This preserves the current light appearance during migration. Phase 7 replaces this with dynamic theme logic.

### Step 4: Verify existing utility classes still work

The following utilities in `globals.css` reference `var(--*)` and should work automatically:
- `.bg-app` -> `var(--bg)`
- `.surface-card` -> `var(--surface)` + border + shadow
- `.surface-panel` -> `var(--surface)` + border + shadow
- `.surface-muted` -> `var(--surface-muted)` + border
- `.text-strong` -> `var(--text)`
- `.text-muted` -> `var(--text-muted)`
- `.text-quiet` -> `var(--text-quiet)`
- `.border-strong` -> `var(--border-strong)`
- `.shadow-lush` -> `var(--shadow-panel)`

No changes needed to these.

### Step 5: Compile check

```bash
cd frontend && pnpm build
```

Verify no build errors. Visual appearance should be identical (`.light` class active).

## Todo List

- [ ] Replace `:root` with dark mode values
- [ ] Add `.light` class with current light values
- [ ] Add `className="light"` to `<html>` in layout.tsx
- [ ] Run `pnpm build` — confirm zero errors
- [ ] Visual spot-check: dashboard looks identical to current

## Success Criteria
- `:root` = dark palette, `.light` = light palette
- With `.light` class on `<html>`, app looks identical to current
- Removing `.light` class shows dark mode (may look broken until phases 3-6 fix hardcoded colors)
- Build passes

## Risk Assessment
- **Low risk:** This is a CSS-only restructure with `.light` preserving current look
- **Mitigation:** If anything breaks visually, re-add the old `:root` values

## Rollback
Revert the single commit. Or: swap `:root` and `.light` contents back.

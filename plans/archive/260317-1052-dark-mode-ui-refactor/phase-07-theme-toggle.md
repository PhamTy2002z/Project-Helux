# Phase 7: Theme Toggle

## Context Links
- [plan.md](./plan.md) | [phase-01](./phase-01-css-foundation.md)
- `frontend/src/app/layout.tsx`
- New files to create (listed below)

## Overview
- **Priority:** MEDIUM
- **Status:** pending
- **Depends on:** Phase 1 (CSS vars must exist)
- **Can run in parallel with:** Phases 4-6
- **Description:** Create ThemeProvider, toggle UI, localStorage persistence, system preference detection, and no-flash blocking script.

## Requirements

### Functional
- Default: dark mode (no class on `<html>`)
- Light mode: `.light` class on `<html>`
- User can toggle between dark/light via a button in the header
- Preference persisted in `localStorage` key `"theme"`
- On first visit: respect `prefers-color-scheme` system preference
- On subsequent visits: use stored preference
- No flash of wrong theme on page load (FOUC prevention)

### Non-functional
- Zero layout shift during theme switch
- Toggle transition: smooth color transition (`transition-colors` on `<html>`)
- SSR-safe: blocking script runs before React hydration
- Bundle impact: minimal (< 1KB for theme logic)

## Architecture

```
layout.tsx
  <html>
    <head>
      <script> // blocking inline script — reads localStorage, sets class
    <body>
      <ThemeProvider> // React context for toggle state
        <DashboardShell>
          <header>
            <ThemeToggle /> // Sun/Moon icon button
```

## Related Code Files

### Files to create
1. `frontend/src/components/providers/theme-provider.tsx` — React context + provider
2. `frontend/src/components/atoms/ThemeToggle.tsx` — Toggle button component

### Files to modify
1. `frontend/src/app/layout.tsx` — Add blocking script, remove hardcoded `.light` class
2. `frontend/src/components/templates/DashboardShell.tsx` — Add ThemeToggle to header
3. `frontend/src/components/templates/dashboard-header-user-info.tsx` — or place toggle here

## Implementation Steps

### Step 1: Create blocking script in `layout.tsx`

Add inline `<script>` in `<head>` that runs before paint. This prevents FOUC.

In `layout.tsx`, inside `<head>`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var stored = localStorage.getItem('theme');
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var theme = stored || (prefersDark ? 'dark' : 'light');
          if (theme === 'light') {
            document.documentElement.classList.add('light');
          } else {
            document.documentElement.classList.remove('light');
          }
        } catch(e) {}
      })();
    `,
  }}
/>
```

Remove the temporary `className="light"` from `<html>` (added in Phase 1 step 3).

Change `<html lang="en" className="light">` back to `<html lang="en" suppressHydrationWarning>`.

`suppressHydrationWarning` is needed because the blocking script may change the class before React hydrates, causing a mismatch.

### Step 2: Create `theme-provider.tsx`

**File:** `frontend/src/components/providers/theme-provider.tsx`

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  const setTheme = useCallback(
    (next: Theme) => applyTheme(next),
    [applyTheme],
  );

  // Listen for system preference changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly chosen
      try {
        if (!localStorage.getItem("theme")) {
          applyTheme(e.matches ? "dark" : "light");
        }
      } catch {}
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [applyTheme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

### Step 3: Create `ThemeToggle.tsx`

**File:** `frontend/src/components/atoms/ThemeToggle.tsx`

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]"
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
```

### Step 4: Wire ThemeProvider into app layout

**File:** `frontend/src/app/layout.tsx`

Wrap `{children}` with `<ThemeProvider>`:

```tsx
import { ThemeProvider } from "@/components/providers/theme-provider";

// In the return:
<body className={`... min-h-screen bg-app text-strong antialiased`}>
  <ThemeProvider>
    {children}
  </ThemeProvider>
  {DevAgentation ? <DevAgentation /> : null}
</body>
```

### Step 5: Add ThemeToggle to header

**File:** `frontend/src/components/templates/DashboardShell.tsx`

Add `ThemeToggle` next to the user info section in the header grid. Import and place before or after `DashboardHeaderUserInfo`:

```tsx
import { ThemeToggle } from "@/components/atoms/ThemeToggle";

// In the header grid, add toggle:
<SignedIn>
  <div className="flex items-center gap-2 pr-4">
    <ThemeToggle />
    <DashboardHeaderUserInfo isOnboardingPath={false} />
  </div>
</SignedIn>
```

### Step 6: Add smooth transition to `<html>`

In `globals.css`, add after the `html { ... }` block:

```css
html.transitioning,
html.transitioning * {
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important;
}
```

Update `ThemeProvider` to briefly add/remove `.transitioning` class during toggle:

```tsx
const applyTheme = useCallback((next: Theme) => {
  document.documentElement.classList.add("transitioning");
  setThemeState(next);
  // ... rest of apply logic ...
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.documentElement.classList.remove("transitioning");
    }, 250);
  });
}, []);
```

This avoids permanent transition performance cost while giving smooth toggle UX.

### Step 7: Compile check

```bash
cd frontend && pnpm build
```

## Todo List

- [ ] Add blocking `<script>` in layout.tsx `<head>`
- [ ] Remove temporary `className="light"` from `<html>`
- [ ] Add `suppressHydrationWarning` to `<html>`
- [ ] Create `frontend/src/components/providers/theme-provider.tsx`
- [ ] Create `frontend/src/components/atoms/ThemeToggle.tsx`
- [ ] Wrap children with `<ThemeProvider>` in layout.tsx
- [ ] Add `<ThemeToggle />` to DashboardShell header
- [ ] Add `.transitioning` CSS class for smooth toggle
- [ ] Run `pnpm build` — zero errors
- [ ] Test: page loads in dark mode (no flash)
- [ ] Test: click toggle -> switches to light (smooth)
- [ ] Test: refresh -> light mode persists
- [ ] Test: clear localStorage -> respects system preference

## Success Criteria
- Theme toggles instantly with smooth color transition
- No FOUC on page load
- Preference persists across page reloads
- System preference respected for first-time visitors
- `suppressHydrationWarning` prevents React mismatch warnings
- Build passes

## Risk Assessment
- **Low:** Standard pattern used by next-themes, shadcn, etc.
- **Hydration mismatch** — mitigated by `suppressHydrationWarning` on `<html>`
- **SSR flash** — mitigated by blocking inline script

## Security Considerations
- `localStorage` access wrapped in try/catch (private browsing fallback)
- No sensitive data stored
- `dangerouslySetInnerHTML` for script — content is static, no user input

## Rollback
Delete the two new files, revert layout.tsx and DashboardShell.tsx changes. Add `.light` class back to `<html>`.

# Code Review: Landing Page Components

**Date:** 2026-03-09
**Branch:** feature/landingpage
**Files:** 13 (11 new, 2 modified)
**LOC:** ~550 (new components only)
**Score: 7.5/10**

## Overall Assessment

Well-structured landing page with good component decomposition, consistent styling, and solid accessibility foundations. The code follows KISS/DRY principles. A few high-priority issues around keyboard navigation, missing wrapper class, and marquee accessibility need attention.

---

## Critical Issues

None.

---

## High Priority

### H1. Product Tabs: Missing keyboard arrow-key navigation
**File:** `landing-page/product-tabs.tsx` (L63-91)
**Impact:** WCAG 2.1 violation. Tab role requires arrow-key navigation per WAI-ARIA tabs pattern. Users relying on keyboard cannot navigate between tabs with arrow keys.
**Fix:**
```tsx
// Add onKeyDown handler to tablist container
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "ArrowRight") setActiveTab((prev) => (prev + 1) % TABS.length);
  if (e.key === "ArrowLeft") setActiveTab((prev) => (prev - 1 + TABS.length) % TABS.length);
};

// On each tab button, add tabIndex logic:
tabIndex={isActive ? 0 : -1}
```
Also add `id={tab.id}` to each tab button so `aria-labelledby` on the panel resolves correctly.

### H2. Testimonial Carousel: Same keyboard nav issue
**File:** `landing-page/testimonial-carousel.tsx` (L94-110)
**Impact:** Same as H1. Dot indicators use `role="tab"` but lack arrow-key support and `tabIndex` management.

### H3. `.landing-page` class never applied
**File:** `globals.css:130` + `landing-page/landing-page.tsx`
**Impact:** `--slide-bg-alt` CSS variable is defined inside `.landing-page` but that class is never added to any element. Feature-cards and testimonial-carousel reference `var(--slide-bg-alt, #131318)` -- works only because of fallback value. If the intent is to use the CSS var, add `className="landing-page"` to the wrapper in `landing-page.tsx`.
**Fix:**
```tsx
// landing-page.tsx line 13
<ScrollProvider>
  <div className="landing-page">  {/* Add wrapper */}
    <LandingNavbar />
    ...
  </div>
</ScrollProvider>
```

### H4. Marquee: No pause mechanism for prefers-reduced-motion in CSS only
**File:** `logo-marquee.tsx`
**Impact:** The CSS `@media (prefers-reduced-motion)` correctly stops animation. However, the first (non-duplicated) row is missing `aria-label` or accessible description. Screen readers will read "Next.js React Tailwind CSS..." twice per row since only the duplicate has `aria-hidden`.
**Fix:** Add `role="marquee"` or a `<p className="sr-only">` describing the section.

---

## Medium Priority

### M1. Navbar scroll listener: No throttling
**File:** `landing-navbar.tsx` (L31-35)
**Impact:** Scroll fires 60+ times/sec. While `passive: true` helps, `setScrolled` triggers re-render on every frame if crossing the 50px threshold repeatedly.
**Recommendation:** Minor -- React batches these. Only worth addressing if profiling shows jank. Could add early return: `if ((window.scrollY > 50) !== scrolled) setScrolled(...)`.

### M2. DRY: Button class strings duplicated across files
**Files:** `landing-navbar.tsx` (BTN_SIGNIN, BTN_SIGNUP), `landing-hero-section.tsx` (PRIMARY_BTN, SECONDARY_BTN)
**Impact:** 4 near-identical button style definitions. Maintenance burden.
**Fix:** Extract to shared `landing-button-styles.ts` or use `cva()` (class-variance-authority).

### M3. Feature cards: `cursor-pointer` on non-interactive div
**File:** `feature-cards.tsx` (L60)
**Impact:** Cards have `cursor-pointer` and hover styles but no click handler or link. Misleading affordance for users.
**Fix:** Either wrap in `<Link>` or remove `cursor-pointer`.

### M4. Social links point to root domains
**File:** `landing-footer.tsx` (L35-38)
**Impact:** `https://github.com`, `https://x.com`, `https://discord.gg` are placeholders. Should be flagged/tracked as TODO.

---

## Low Priority

### L1. `new Date().getFullYear()` in footer
**File:** `landing-footer.tsx` (L79)
**Impact:** Creates new Date on every render. Negligible perf but could be a constant or computed at module level.

### L2. HlsVideo src is hardcoded Mux URL
**File:** `landing-hero-section.tsx` (L29)
**Impact:** Should ideally be an env var or constant from config for easier management.

---

## Positive Observations

- **Reduced motion:** Excellent coverage. ScrollProvider skips Lenis, ScrollReveal falls back to static div, ProductTabs/TestimonialCarousel respect `useReducedMotion()`, CSS marquee stops animation.
- **Focus-visible:** Consistent `focus-visible:ring-2` on all interactive elements across navbar, tabs, pricing, footer.
- **ARIA usage:** `role="tablist"`, `aria-selected`, `aria-controls`, `aria-live="polite"` on carousel, `aria-label` on social links.
- **Semantic HTML:** Proper `<nav>`, `<main>`, `<section>`, `<footer>`, `<blockquote>` usage.
- **Component structure:** Clean separation, each file under 170 lines, orchestrator pattern in `landing-page.tsx`.
- **Mobile:** Responsive grid breakpoints, hamburger menu with `aria-expanded`.
- **Lenis cleanup:** Proper `cancelAnimationFrame` + `lenis.destroy()` in useEffect cleanup.

---

## Recommended Actions (Priority Order)

1. **[H1/H2]** Add arrow-key navigation + tabIndex to ProductTabs and TestimonialCarousel tabs
2. **[H3]** Add `className="landing-page"` wrapper so CSS var resolves without fallback
3. **[M2]** Extract shared button styles to reduce duplication
4. **[M3]** Remove `cursor-pointer` from feature cards or make them interactive
5. **[M4]** Track placeholder social URLs as TODO

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Safety | Good -- TypeScript interfaces, no `any` |
| a11y Coverage | ~80% (missing keyboard tab nav) |
| Reduced Motion | 95% (comprehensive) |
| Linting Issues | 0 (build passes) |
| Security | No XSS, no dangerouslySetInnerHTML, no user input rendered |
| Mobile | Good responsive breakpoints |

---

## Unresolved Questions

1. Is `.landing-page` class intentionally unused, or was it forgotten during integration?
2. Are the footer social URLs (github.com, x.com, discord.gg) permanent placeholders or should they point to actual project accounts?
3. Should feature cards be clickable (navigating to product detail pages)?

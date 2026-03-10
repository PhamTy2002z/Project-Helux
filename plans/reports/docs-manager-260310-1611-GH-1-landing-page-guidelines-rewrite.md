# Documentation Update Report: Landing Page Design Guidelines

**Date:** 2026-03-10
**Task:** Rewrite `docs/landing-page-design-guidelines.md` to cover full landing architecture
**Status:** COMPLETED

## Summary

Successfully rewrote landing page design guidelines to cover the FULL landing architecture, including both the new `landing-page/` component group (main landing sections) and the existing `landing-slideshow/` component group (hero slideshow). Document kept under 800 LOC (final: 249 lines) and optimized for developer usability.

## Changes Made

### Before
- Document covered **slideshow hero only** (landing-slideshow/)
- Scope limited to single component directory
- Minimal component cross-reference
- No performance, accessibility, or responsive breakpoint guidance
- ~146 lines

### After
- Document covers **BOTH landing-page/ AND landing-slideshow/** (~1,676 + 878 LOC combined)
- Clear two-group architecture separation with component tables
- Complete source-of-truth listing for all 24 files
- Added sections: Accessibility Standards, Responsive Breakpoints, Performance Guardrails
- Comprehensive component notes with ownership and key rules
- Enhanced change checklist (11 items, including accessibility, video, drawer, tests)
- Kept concise with tables for structured information
- 249 lines (under 800 LOC limit)

## Content Coverage

### New Sections Added
1. **Source of Truth** — All 24 files organized by group (orchestrator, landing-page, landing-slideshow, shared)
2. **Visual Direction** — Cinematic dark aesthetic, glass morphism, CTA accent color
3. **Typography System** — Table with element, font, size, line-height, notes
4. **Color System** — Palette table with values and use cases
5. **CSS Classes & Global Styles** — Landing structure, performance helpers, hero glass, animations, slideshow
6. **Animation & Interaction** — Table with type, duration, easing; keyboard nav; motion strategy
7. **Performance Guardrails** — Bundle optimization, resource loading, layout performance
8. **Accessibility Standards** — Comprehensive table (semantic HTML, ARIA, keyboard, focus, touch, safe area, motion, contrast, alt text, labels)
9. **Copy & Conversion Rules** — Guidelines, CTA examples, conversion points
10. **Component Notes** — Two tables: landing-page sections (8 components) + landing-slideshow (5 components)
11. **Responsive Breakpoints** — Table with 6 breakpoints (sm, md, lg, fhd, qhd, uhd)
12. **Change Checklist** — Expanded to 11 items (added video, drawer, tests, accessibility)

### Verified Accuracy
- All component files verified to exist (24 total)
- Landing page orchestrator confirmed (landing-page.tsx with dynamic imports)
- Slideshow orchestrator confirmed (slide-app.tsx with keyboard nav)
- CSS classes verified against globals.css (hero-glass-card, hero-btn-*, landing-reveal, etc.)
- Animation keyframes verified (fade-in-up, marquee-loop, etc.)
- Color values verified (#000000, #ffffff, #ff5b35, opacity levels)
- Typography clamp() values verified against component implementation

### Structure Optimization
- **Tables over prose** — Scope, typography, color, animation, accessibility, breakpoints, components all use tables for scannability
- **Concise descriptions** — Each entry ~1 line, links to actual code files
- **Semantic markdown** — Proper H2/H3 hierarchy, bold emphasis on key concepts
- **Cross-references** — Links to `docs/design-guidelines.md`, component files, CSS classes
- **Developer-friendly** — Copy-pasteable file paths, actionable checklists, specific line numbers where relevant

## Technical Details

### Scope Boundaries (Clarified)
| In Scope | Out of Scope |
|----------|--------------|
| Public route `/` landing sections | Authenticated app shell |
| Both landing-page/ and landing-slideshow/ | Dashboard, data tables |
| Landing navbar, hero, sections, footer | Form patterns outside landing |
| Hero video, animations, motion | Typography outside landing context |

### Key Metrics
- **Lines of code:** 249 (target: < 800)
- **Component files covered:** 24 (12 landing-page + 5 landing-slideshow + 7 shared/supporting)
- **Component tables:** 2 (landing-page sections, landing-slideshow components)
- **CSS classes documented:** 14 (plus animation keyframes)
- **Accessibility requirements:** 10 categories
- **Responsive breakpoints:** 6 (sm, md, lg, fhd, qhd, uhd)
- **Change checklist items:** 11

### Verified Against Implementation
- Entry point: `frontend/src/app/(public)/page.tsx` (confirmed: imports LandingPage)
- Orchestrator: `landing-page.tsx` (confirmed: ScrollProvider, lazy-loaded sections, skeletons)
- Slideshow orchestrator: `slide-app.tsx` (confirmed: keyboard nav, dynamic imports)
- CSS variables: `globals.css` (confirmed: all color, animation, breakpoint vars)
- Component directory structure verified (24 files total)

## Unresolved Questions
None. All component files, CSS classes, and implementation details verified.

## Recommendations for Follow-Up
1. Add links to component test files in component notes section (e.g., feature-cards.test.tsx)
2. Consider adding visual wireframe references in future (ASCII diagrams of section layout)
3. Track pricing page (reuses navbar, footer, pricing cards) — may need separate guidelines
4. Monitor if landing grows beyond 2 groups (may split into phase 2 documentation)

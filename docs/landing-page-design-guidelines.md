# Landing page design guidelines

This document defines UI, motion, copy, and performance rules only for the
public landing page (`/`). Use it when you edit files under
`frontend/src/components/organisms/landing-slideshow/` and related landing
entry files.

## Scope and precedence

This guide prevents overlap with the global design guide by setting explicit
boundaries.

- Scope in: public landing route and slideshow hero only.
- Scope out: authenticated app shell, dashboard pages, data tables, and form
  patterns outside landing.
- Base reference: [`docs/design-guidelines.md`](./design-guidelines.md).
- Precedence rule: if a rule here conflicts with the global guide, this file
  wins for landing files only.

## Source of truth

These files are the implementation baseline for this guideline.

- `frontend/src/app/(public)/page.tsx`
- `frontend/src/components/organisms/LandingHero.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-app.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-1.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-2.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-3.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-4.tsx`
- `frontend/src/components/organisms/landing-slideshow/slide-5.tsx`
- `frontend/src/components/organisms/landing-slideshow/animated-text.tsx`
- `frontend/src/components/organisms/landing-slideshow/hls-video.tsx`
- `frontend/src/components/organisms/landing-slideshow/navigation-dots.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`

## Visual direction

Landing must feel cinematic and high-contrast while keeping clear readability.
The style is intentional and bold, not dashboard-like.

- Use dark canvas backgrounds with white foreground typography.
- Keep foreground content readable with video overlays (`bg-black/35` or
  stronger when needed).
- Keep primary brand lockup minimal: short logo, concise meta strip, large
  hero statement.
- Keep one key message per slide. Avoid dense multi-column text blocks.

## Typography and spacing

Typography must support scan speed and impact.

- Use `Aeonik` for landing surface, with
  `var(--font-body), sans-serif` fallback.
- Use `text-balance` for large headlines when possible.
- Keep headline line-height tight (`~0.9`) and body text at comfortable
  reading size (`14px` to `20px` clamp).
- Keep horizontal page gutters around `5%` on desktop slides.
- Keep copy width constrained (`max-w-*`) to avoid long line lengths.

## Motion and interaction

Motion must communicate progression, not decoration.

- Animate `opacity` and `transform` only.
- Honor `prefers-reduced-motion` in all animated primitives.
- Keep slide transition short (`~0.35s`) and interruptible by user input.
- Keep keyboard navigation enabled on landing:
  - Next: `ArrowRight`, `ArrowDown`, `Space`
  - Previous: `ArrowLeft`, `ArrowUp`
- Dot controls must expose clear active state and keyboard focus style.

## Accessibility requirements

Landing is visual-heavy, but it must still meet baseline accessibility.

- Every interactive element must have visible `focus-visible` styles.
- Icon-only or dot navigation controls must have `aria-label`.
- Decorative media must be `aria-hidden` when not meaningful content.
- Do not disable zoom or block user input behaviors.
- Keep CTA labels specific and action-oriented.

## Performance guardrails

Landing must load quickly and avoid jank.

- Lazy-load non-initial slides with `next/dynamic`.
- Preload only neighboring slides for faster perceived navigation.
- Load `hls.js` dynamically inside video setup, not at module top level.
- Use `preload="metadata"` for autoplay background videos.
- Add `preconnect` for streaming and font domains in root layout.
- Avoid `transition: all`; list transition properties explicitly.
- Keep listeners stable and avoid effect rebind loops.

## Copy and conversion rules

Landing copy must be direct, benefit-first, and easy to act on.

- Use active voice and second person framing.
- Start with outcome, then mechanism.
- Keep headline short and specific.
- Keep subheadline to one clear value proposition.
- Keep CTA language concrete:
  - Good: "Start Free in 2 Minutes"
  - Avoid: "Continue" or "Learn More"
- Keep one primary CTA and one secondary CTA per decision point.

## Component-level implementation notes

Use these rules when editing landing slideshow components.

- `slide-app.tsx`
  - Owns slide orchestration, keyboard handling, dynamic imports, and transition
    behavior.
- `slide-1.tsx`
  - Owns main hero proposition and primary conversion actions.
- `slide-2.tsx` to `slide-5.tsx`
  - Support narrative and credibility. Avoid adding heavy logic here.
- `animated-text.tsx`
  - Must keep reduced-motion fallbacks for all animation helpers.
- `hls-video.tsx`
  - Must clean up HLS/native listeners on unmount.
- `navigation-dots.tsx`
  - Must keep focus ring visibility, touch-friendly targets, and pressed state.

## Change checklist

Run this checklist before merging landing updates.

1. Verify only landing-scoped files changed.
2. Verify reduced-motion mode still works.
3. Verify keyboard slide navigation still works.
4. Verify CTA focus styles are visible on keyboard tab.
5. Verify `npm run lint` passes for changed frontend files.
6. Verify `npm run build` passes in `frontend/`.
7. Verify copy still matches product positioning and auth flow.

## Next steps

If landing grows beyond the hero slideshow, split this file into:

- `docs/landing-page-design-guidelines.md` (principles)
- `docs/landing-page-content-guidelines.md` (copy system)
- `docs/landing-page-performance-guidelines.md` (budgets and profiling)

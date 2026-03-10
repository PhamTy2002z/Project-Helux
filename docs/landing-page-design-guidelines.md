# Landing Page Design Guidelines

This document defines UI, motion, copy, performance, and accessibility rules for
the public landing page (`/`). It covers TWO major component groups:
**landing-page/** (new main landing sections) and **landing-slideshow/**
(hero slideshow).

## Scope and Precedence

Landing page has explicit boundaries to prevent overlap with global design guide.

| In Scope | Out of Scope |
|----------|--------------|
| Public route `/` landing sections | Authenticated app shell |
| Both landing-page/ and landing-slideshow/ | Dashboard, data tables |
| Landing navbar, hero, sections, footer | Form patterns outside landing |
| Hero video, animations, motion | Typography outside landing context |

Base reference: `docs/design-guidelines.md`. This file takes precedence for
landing-scoped files only.

## Source of Truth

**Orchestrator & Entry:**
- `frontend/src/app/(public)/page.tsx` — Page metadata + LandingPage import
- `frontend/src/components/organisms/landing-page/landing-page.tsx` — Orchestrator with lazy-loaded sections

**Landing-Page Section Components (new):**
- `landing-navbar.tsx` — Fixed glass navbar with mobile drawer
- `landing-hero-section.tsx` — Hero with dual-video, staggered copy animations
- `feature-cards.tsx` — 2-column feature grid with hover zoom
- `product-tabs.tsx` — 4-tab WAI-ARIA interface with video previews
- `pricing-cards.tsx` — 3-tier pricing (Basic/Professional/Enterprise)
- `trust-marquee.tsx` — Brand logo infinite scroll (15 brands)
- `testimonial-carousel.tsx` — Auto-advance quote carousel
- `logo-marquee.tsx` — Tech stack badge marquee
- `scroll-reveal.tsx` — Reusable IntersectionObserver trigger
- `landing-footer.tsx` — Footer with link columns, social icons

**Landing-Slideshow Components (hero slideshow):**
- `landing-slideshow/slide-app.tsx` — Orchestration, keyboard nav, dynamic imports
- `landing-slideshow/slide-*.tsx` (1-5) — Individual slide narratives
- `landing-slideshow/animated-text.tsx` — 3 animation primitives (SlideUpLine, WordByWordReveal, BlurReveal)
- `landing-slideshow/hls-video.tsx` — HLS streaming with Mux CDN
- `landing-slideshow/navigation-dots.tsx` — Slide dot navigation

**Shared:**
- `frontend/src/app/globals.css` — All landing CSS classes, variables, keyframes
- `frontend/src/components/providers/scroll-provider.tsx` — Lenis smooth scroll

## Visual Direction

Landing must feel **cinematic, high-contrast, bold** — not dashboard-like.

- Dark canvas (`#000000` background, `#ffffff` text)
- Readable overlays: `bg-black/35` or stronger over video
- High-contrast: white text on dark backgrounds, glass cards with subtle opacity
- Glass morphism: `bg-white/[0.05]`, `border-white/10`
- CTA accent: `#ff5b35` (orange) with drop shadow for emphasis
- One key message per section; avoid dense multi-column text blocks

## Typography System

| Element | Font | Size | Line-Height | Notes |
|---------|------|------|-------------|-------|
| Hero title | `var(--font-body)` | `clamp(36px, 3.5vw, 88px)` | ~0.9 | Tight, impactful |
| Section heading | `var(--font-body)` | `clamp(26px, 3.5vw, 52px)` | ~0.9 | Maintain hierarchy |
| Body text | `var(--font-body)` | `clamp(14px, 1.8vw, 20px)` | 1.5-1.75 | Readable at all sizes |
| Slideshow (Aeonik) | `Aeonik` | Varies | — | Used in slideshow only |

Guidelines:
- Use `text-balance` for large headlines
- Constrain copy width with `max-w-*` to avoid line-length > 75 chars
- Maintain 5% horizontal gutters on desktop
- All scaling via `clamp()` for responsive without breakpoints

## Color System

| Palette | Value | Use |
|---------|-------|-----|
| Background | `#000000` | Page canvas |
| Text primary | `#ffffff` | All foreground text |
| Text muted | Opacity /35 to /55 | Secondary, meta text |
| Glass card bg | `rgba(255,255,255,0.03-0.12)` | Card backgrounds |
| Glass border | `rgba(255,255,255,0.06-0.25)` | Card borders, dividers |
| CTA accent | `#ff5b35` | Primary buttons, highlights |
| Slideshow vars | See CSS section | Slides only |

Opacity levels: /35, /45, /50, /55, /65, /70, /80, /85, /90 (used in glass cards and text).

## CSS Classes & Global Styles

**Landing structure:**
- `.landing-page` — Root font override, `var(--font-body)`

**Performance helpers:**
- `.landing-deferred-section` — `content-visibility: auto`, `contain-intrinsic-size: 920px`
- `.landing-reveal` — Fade-in-up on scroll (opacity 0→1, translateY 24→0, 0.5s)

**Hero section (glass + buttons):**
- `.hero-glass-card` — `bg-white/5`, `border-white/10`
- `.hero-btn-primary` — Black bg, white border, rounded-full
- `.hero-btn-secondary` — Glass bg, glass border, hover brightens
- `.hero-btn-demo` — `#ff5b35` orange with `0 12px 28px rgba(255,91,53,0.35)` shadow

**Animations:**
- `.hero-copy-anim` — Staggered fade-in-up via `--hero-copy-delay` (title 120ms, subtitle 240ms, CTA 360ms)
- `.animate-marquee-loop` — Infinite horizontal scroll (32s linear), uses `--marquee-end: -50%`
- `.fade-in-up` — Keyframe (opacity 0→1, translateY 16→0)

**Slideshow:**
- `.landing-slideshow` — CSS vars for slide colors (muted, purple, pink, blue-light, blue-dark, etc.)

All animations respect `prefers-reduced-motion: reduce` — disabled on motion-sensitive users.

## Animation & Interaction

| Type | Duration | Easing | Notes |
|------|----------|--------|-------|
| Slide transitions | ~350ms | ease-out | Interruptible by user |
| Fade-in-up (scroll) | 500ms | ease-out | 24px translate, opacity 0→1 |
| Marquee loop | 32s | linear | Infinite, seamless (transform -50%) |
| Copy stagger | 120-360ms | ease-out | Delay via CSS var (title→subtitle→CTA) |
| Hover (buttons) | 300ms | ease-all | Border opacity, background shift, translateY |

**Keyboard navigation:**
- Next slide: `ArrowRight`, `ArrowDown`, `Space`
- Previous slide: `ArrowLeft`, `ArrowUp`
- Tabs/carousel: `Tab` for focus, `Arrow` keys for selection within tabs
- All interactive elements: visible `focus-visible` ring (2px white)

**Motion strategy:**
- Animate `opacity` and `transform` only (GPU-optimized)
- Use `translate3d()` for 3D acceleration
- Avoid `transition: all` — list properties explicitly
- Respect `prefers-reduced-motion` globally

## Performance Guardrails

**Bundle optimization:**
- Lazy-load below-fold sections via `next/dynamic` with skeleton fallbacks
- Slideshow slides load dynamically (not bundled inline)
- HLS.js loaded inside `hls-video.tsx`, not at module top

**Resource loading:**
- Video `preload="metadata"` to load poster only until interaction
- `preconnect` in root layout for streaming & font domains
- Adjacent slide preloading in slideshow for perceived speed
- Network-aware video: checks Connection API, deviceMemory >= 8GB, hardwareConcurrency >= 8

**Layout performance:**
- `content-visibility: auto` on deferred sections with `contain-intrinsic-size`
- Images via Next.js Image component with `quality: 92`, responsive sizes
- Video lazy-load via IntersectionObserver (rootMargin 240px)
- ScrollProvider conditionally loaded (skips on ≤4 cores or data-saver mode)

## Accessibility Standards

| Category | Requirement | Implementation |
|----------|-------------|-----------------|
| Semantic HTML | Use `nav`, `main`, `section`, `article`, `footer`, `blockquote` | Correct sectioning |
| ARIA | `role="navigation"`, `aria-label` on icon buttons, `aria-selected` on tabs | All interactive elements |
| Keyboard | Tab order matches visual order; Arrow keys for tabs/carousel | Test keyboard-only flow |
| Focus | `focus-visible` ring (2px white) on all interactive elements | Check against prefers-reduced-motion |
| Touch targets | Minimum 44x44px for all clickable areas | Test on mobile |
| Safe area | Use `env(safe-area-inset-*)` for notched devices | Navbar, hero padding |
| Motion | All animations disabled for `prefers-reduced-motion` | Opacity/transform removed |
| Color contrast | Text ≥ 4.5:1 on dark backgrounds | #ffffff on #000000 = 21:1 |
| Alt text | Descriptive alt for meaningful images; `aria-hidden` for decorative | Review each image |
| Form labels | Linked label elements with `for` attribute | All inputs labeled |

## Copy & Conversion Rules

Landing copy must be direct, outcome-first, benefit-driven.

**Guidelines:**
- Use active voice and second-person framing ("You control", "Your board")
- Start with outcome, then explain mechanism
- Keep headlines short, specific, benefit-focused
- Subheadings: one clear value prop per section
- CTAs: concrete, action-oriented language

**CTA examples:**
- Good: "Start Free in 2 Minutes", "Request a Demo", "Contact Sales"
- Avoid: "Continue", "Learn More", "Submit"

**Conversion points:**
- One primary + one secondary CTA per decision point
- Testimonials with real titles and companies (builds credibility)
- Feature benefits use outcome-first language ("Save 10 hours weekly on approvals")

## Component Notes

### Landing-Page Sections

| Component | Owner | Key Rules |
|-----------|-------|-----------|
| `landing-navbar.tsx` | Navbar orchestration | Fixed glass, mobile drawer < 1024px, resources dropdown, keyboard focus on links |
| `landing-hero-section.tsx` | Hero orchestration | Dual-video blend, staggered copy animations, network-aware video loading |
| `feature-cards.tsx` | Feature showcase | 2-column grid, hover zoom on images, semantic structure |
| `product-tabs.tsx` | Product overview | 4-tab WAI-ARIA, AnimatePresence transitions, video in active tab only |
| `testimonial-carousel.tsx` | Social proof | Auto-advance, manual nav, Framer motion slide transitions |
| `trust-marquee.tsx` | Brand credibility | 15 brands, infinite scroll, no pause on hover (auto-advance) |
| `logo-marquee.tsx` | Tech stack | Tech badges, 2 rows, marquee-loop animation |
| `pricing-cards.tsx` | Pricing tiers | 3 tiers (Basic/Pro/Enterprise), CTA per card, hover state |
| `landing-footer.tsx` | Footer | Link columns, social icons, dark glass style, semantic footer |

### Landing-Slideshow Components

| Component | Owner | Key Rules |
|-----------|-------|-----------|
| `slide-app.tsx` | Orchestration | Keyboard nav, dynamic imports, clampIndex(), transition to activeIndex |
| `slide-1.tsx` to `slide-5.tsx` | Slide content | One message per slide, no heavy logic, animated-text usage |
| `animated-text.tsx` | Text animation primitives | SlideUpLine, WordByWordReveal, BlurReveal — all respect prefers-reduced-motion |
| `hls-video.tsx` | Video streaming | HLS via Mux, cleanup listeners on unmount, poster covers load time |
| `navigation-dots.tsx` | Dot navigation | Focus ring visibility, touch-friendly (44x44px+), pressed state, aria-label |

## Responsive Breakpoints

| Breakpoint | Usage | Context |
|------------|-------|---------|
| sm (640px) | Mobile landscape, small tablets | Single-column layouts |
| md (768px) | Tablets | Video enabled (< 768px: disabled) |
| lg (1024px) | Desktop, mobile drawer hidden | Multi-column, navbar full |
| fhd (1920px) | Full HD | Increased max-width, padding |
| qhd (2560px) | 2K displays | Higher max-width |
| uhd (3840px) | 4K displays | Extended padding/max-width |

Mobile drawer visible at `< 1024px` only.

## Change Checklist

Before merging landing updates, run:

1. Verify only landing-scoped files changed (not auth, dashboard, etc.)
2. Verify `prefers-reduced-motion` works across all sections (animations disabled)
3. Verify keyboard navigation:
   - Tabs in product-tabs work with Arrow keys
   - Testimonial carousel manual nav works
   - Slideshow next/prev work (Arrow keys, Space)
   - All CTAs accessible via Tab
4. Verify CTA focus styles visible on keyboard Tab
5. Verify video playback on desktop (≥ 768px)
6. Verify mobile drawer opens/closes correctly (< 1024px)
7. Verify lazy-loaded sections render with skeleton loaders
8. Run `pnpm lint` — no errors
9. Run `pnpm build` — no errors
10. Run landing component tests: `pnpm test landing-page/`
11. Verify copy matches product positioning (mission control, approvals, gateways)

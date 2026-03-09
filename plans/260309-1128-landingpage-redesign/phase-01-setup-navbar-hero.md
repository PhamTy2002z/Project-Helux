# Phase 1: Setup + Navbar + Hero

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 3h
- Install Lenis, create scroll provider, build fixed navbar, convert slide-1 into hero section

## Context
- [Brainstorm report](../reports/brainstorm-260309-1128-crewai-design-extract.md)
- [Slide 1 (current hero)](../../frontend/src/components/organisms/landing-slideshow/slide-1.tsx)
- [SlideApp (current orchestrator)](../../frontend/src/components/organisms/landing-slideshow/slide-app.tsx)

## Key Insights
- Slide-1 already has: HLS video bg, animated text (SlideUpLine, BlurReveal), Clerk auth CTAs, Logo component
- Reuse all of these — just restructure from fullscreen slide to hero section
- Lenis smooth scroll replaces native scroll for premium feel
- Navbar needs transparent-to-solid transition on scroll

## Requirements

### Functional
- Fixed navbar with logo, menu links, auth buttons (Sign in / Sign up)
- Hero section (100vh) with video background, headline, subtext, CTAs
- Smooth scroll via Lenis
- Navbar becomes opaque on scroll (>50px)

### Non-Functional
- First Contentful Paint not degraded by Lenis
- Respect `prefers-reduced-motion`
- Mobile responsive (stack nav items, hamburger menu)

## Related Code Files

### Create
| File | Path | Purpose |
|------|------|---------|
| scroll-provider.tsx | `frontend/src/components/providers/scroll-provider.tsx` | Lenis smooth scroll context provider |
| landing-navbar.tsx | `frontend/src/components/organisms/landing-page/landing-navbar.tsx` | Fixed transparent navbar |
| landing-hero-section.tsx | `frontend/src/components/organisms/landing-page/landing-hero-section.tsx` | Hero section (adapted from slide-1) |
| landing-page.tsx | `frontend/src/components/organisms/landing-page/landing-page.tsx` | Main page orchestrator (replaces SlideApp) |

### Modify
| File | Path | Change |
|------|------|--------|
| page.tsx | `frontend/src/app/(public)/page.tsx` | Import LandingPage instead of LandingHero |
| package.json | `frontend/package.json` | Add `lenis` dependency |

## Implementation Steps

### 1. Install Lenis
```bash
cd frontend && pnpm add lenis
```

### 2. Create ScrollProvider
```tsx
// scroll-provider.tsx
"use client";
import { ReactNode, useEffect, useRef } from "react";
import Lenis from "lenis";

export function ScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.2,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return <>{children}</>;
}
```

### 3. Create LandingNavbar
- Fixed position, z-50, transparent bg
- On scroll >50px: `bg-black/80 backdrop-blur-md`
- Left: Logo component (reuse from landing-slideshow/logo.tsx)
- Center/Right: Menu links (Features, Product, Pricing)
- Far right: Sign in / Sign up (Clerk aware)
- Mobile: hamburger menu with slide-out drawer

### 4. Create LandingHeroSection
- Extract from slide-1: video bg, overlay, headline, subtext, CTAs
- Keep 100vh height
- Remove deckMeta (Type, Product, Date, Mode) — not needed in scroll page
- Keep animated text components (SlideUpLine, BlurReveal)
- Center content vertically or keep bottom-left aligned (CrewAI centers it)

### 5. Create LandingPage orchestrator
```tsx
// landing-page.tsx
import { ScrollProvider } from "@/components/providers/scroll-provider";
import LandingNavbar from "./landing-navbar";
import LandingHeroSection from "./landing-hero-section";

export default function LandingPage() {
  return (
    <ScrollProvider>
      <LandingNavbar />
      <main>
        <LandingHeroSection />
        {/* Phase 2-4 sections added here */}
      </main>
    </ScrollProvider>
  );
}
```

### 6. Update page.tsx
```tsx
import LandingPage from "@/components/organisms/landing-page/landing-page";
export default function Page() {
  return <LandingPage />;
}
```

## Todo List
- [x] Install `lenis` package
- [x] Create ScrollProvider with Lenis init
- [x] Create LandingNavbar (transparent → solid on scroll)
- [x] Create LandingHeroSection (adapt slide-1)
- [x] Create LandingPage orchestrator
- [x] Update public page.tsx import
- [x] Test video playback in hero
- [x] Test navbar scroll transition
- [x] Test mobile responsive navbar

## Success Criteria
- Navbar visible and transitions on scroll
- Hero section renders with video, text animations, CTAs
- Smooth scroll works across page
- Auth buttons functional (Clerk)
- No regressions on existing pages

## Risk Assessment
- **Lenis + Next.js SSR**: Lenis is client-only, must wrap in `"use client"` + useEffect
- **Video autoplay**: Mobile browsers may block — HLS component already handles this
- **Navbar z-index**: Must be above hero video overlay — use z-50

## Next Steps
- Phase 2 adds ScrollReveal, LogoMarquee, FeatureCards below hero

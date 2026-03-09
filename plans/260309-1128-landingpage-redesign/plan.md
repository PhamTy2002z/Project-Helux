---
title: "Landing Page Redesign: Slideshow → Long-Scroll"
description: "Convert fullscreen slideshow to CrewAI-style long-scroll landing page with 8 new sections"
status: complete
priority: P1
effort: 12h
branch: feature/landingpage
tags: [frontend, landing-page, ui, redesign]
created: 2026-03-09
completed: 2026-03-09
---

# Landing Page Redesign: Slideshow → Long-Scroll

## Overview

Convert Helux landing page from 5-slide fullscreen slideshow to CrewAI-inspired long-scroll single page. Reuse existing content/components, add Lenis smooth scroll, create 8 new section components.

## Context

- Brainstorm: [crewai-design-extract](../reports/brainstorm-260309-1128-crewai-design-extract.md)
- Branch: `feature/landingpage`
- Stack: Next.js 16 + Framer Motion + Tailwind CSS + Clerk auth

## Key Decisions

- Keep Framer Motion (no GSAP migration)
- Add `lenis` for smooth scroll
- Reuse slide-1 hero content + HLS video + animated text
- Dark theme dominant, alternate light sections
- Reuse existing CSS variables (--slide-*)

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Setup + Navbar + Hero | Complete | 3h | [phase-01](./phase-01-setup-navbar-hero.md) |
| 2 | ScrollReveal + LogoMarquee + Features | Complete | 3h | [phase-02](./phase-02-scroll-marquee-features.md) |
| 3 | ProductTabs + Testimonials | Complete | 3h | [phase-03](./phase-03-product-tabs-testimonials.md) |
| 4 | Pricing + Footer + Integration | Complete | 2h | [phase-04](./phase-04-pricing-footer-integration.md) |
| 5 | Polish + Responsive + A11y | Complete | 1h | [phase-05](./phase-05-polish-responsive-a11y.md) |

## Dependencies

- `lenis` package (new dependency)
- Existing: framer-motion, hls.js, @clerk/nextjs, lucide-react
- Content: Product screenshots for ProductTabs, placeholder logos for marquee

## File Ownership Matrix

| Phase | Creates | Modifies |
|-------|---------|----------|
| 1 | landing-navbar.tsx, landing-hero-section.tsx, landing-page.tsx, scroll-provider.tsx | package.json, page.tsx |
| 2 | scroll-reveal.tsx, logo-marquee.tsx, feature-cards.tsx | landing-page.tsx |
| 3 | product-tabs.tsx, testimonial-carousel.tsx | landing-page.tsx |
| 4 | pricing-cards.tsx, landing-footer.tsx | landing-page.tsx, globals.css |
| 5 | (none) | All landing components (polish only) |

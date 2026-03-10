# Phase 2: ScrollReveal + LogoMarquee + FeatureCards

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 3h
- Create reusable scroll-triggered animation wrapper, logo marquee, and 3-column feature cards

## Key Insights
- CrewAI uses GSAP ScrollTrigger at "top 80%" — replicate with Framer Motion `whileInView`
- Logo marquee uses CSS animation for infinite scroll (no JS needed)
- Feature cards: Easy / Trusted / Scalable pattern → adapt for Helux: Boards / Agents / Gateways

## Related Code Files

### Create
| File | Path | Purpose |
|------|------|---------|
| scroll-reveal.tsx | `frontend/src/components/organisms/landing-page/scroll-reveal.tsx` | Reusable scroll-triggered fade-in wrapper |
| logo-marquee.tsx | `frontend/src/components/organisms/landing-page/logo-marquee.tsx` | Infinite scroll logo bar |
| feature-cards.tsx | `frontend/src/components/organisms/landing-page/feature-cards.tsx` | 3-column feature showcase |

### Modify
| File | Change |
|------|--------|
| landing-page.tsx | Add LogoMarquee + FeatureCards sections |
| globals.css | Add marquee keyframes |

## Implementation Steps

### 1. ScrollReveal Component
```tsx
"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20%" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

### 2. LogoMarquee
- Section heading: "Trusted by teams building the future" (or similar)
- 2 rows of duplicated logos for seamless infinite scroll
- CSS `@keyframes marquee` animation
- Logos: Use tech stack SVGs (Next.js, React, Tailwind, etc.) or placeholder partner logos
- Grayscale filter, subtle opacity
- Dark bg section

### 3. FeatureCards
Adapt CrewAI's Easy/Trusted/Scalable to Helux context:

| CrewAI | Helux | Content |
|--------|-------|---------|
| Easy | Boards | Visual editor, integrated tools, intuitive APIs → Board management, task tracking, real-time sync |
| Trusted | Agents | Workflow tracing, training, guardrails → Agent health, automated workflows, audit trails |
| Scalable | Gateways | LLM config, RBAC, containers → Gateway routing, skill packs, role-based access |

Card structure:
```
┌──────────────────┐
│ [Screenshot/img] │
│ Title (h3)       │
│ Description      │
│ ○ Feature 1      │
│ ○ Feature 2      │
│ ○ Feature 3      │
└──────────────────┘
```
- Use Lucide icons for bullet points
- Cards have subtle border, hover shadow
- Responsive: 3-col desktop → 1-col mobile

## Content (from existing slides)

**Boards (from slide-2 stats):**
- Unified task dashboard — no context switching
- Real-time approval routing
- Live execution signals

**Agents (from slide-4):**
- Coordinate humans and agents in one loop
- Approval workflows built in
- Full execution visibility

**Gateways (from slide-3 chart concept):**
- Track execution momentum
- Historical performance data
- Cross-board analytics

## Todo List
- [x] Create ScrollReveal component
- [x] Create LogoMarquee with CSS animation
- [x] Add marquee keyframes to globals.css
- [x] Create FeatureCards with 3 columns
- [x] Source/create placeholder logos (SVG)
- [x] Wire into landing-page.tsx
- [x] Test scroll animations trigger correctly
- [x] Test mobile responsive layout

## Success Criteria
- ScrollReveal triggers at ~80% viewport
- Logo marquee scrolls infinitely without jank
- Feature cards render in 3 columns (desktop), 1 column (mobile)
- All text content adapted from slide 2-4 content

## Next Steps
- Phase 3 adds ProductTabs and TestimonialCarousel

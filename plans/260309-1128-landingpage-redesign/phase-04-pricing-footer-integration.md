# Phase 4: PricingCards + Footer + Integration

## Overview
- **Priority:** P2
- **Status:** Complete
- **Effort:** 2h
- Getting started / pricing cards, footer, final section assembly

## Key Insights
- CrewAI has 3 tiers: Cloud / Factory / OSS
- Helux equivalent: Free / Pro / Self-hosted (or adapt to current offering)
- Footer: 4 columns with links + social icons
- This phase connects all sections into final landing-page.tsx

## Related Code Files

### Create
| File | Path | Purpose |
|------|------|---------|
| pricing-cards.tsx | `frontend/src/components/organisms/landing-page/pricing-cards.tsx` | Getting started tier cards |
| landing-footer.tsx | `frontend/src/components/organisms/landing-page/landing-footer.tsx` | Page footer |

### Modify
| File | Change |
|------|--------|
| landing-page.tsx | Add PricingCards + LandingFooter, finalize section order |

## Implementation Steps

### 1. PricingCards

**Section heading:** "Ready to get started?"

**Cards (adapt to Helux offering):**

| Tier | Icon | Description | CTA |
|------|------|-------------|-----|
| Free | Cloud icon | Get started with boards, basic agents, community support | "Start Free" → /onboarding |
| Pro | Hexagon icon | Advanced agents, gateways, priority support, analytics | "Upgrade" → /pricing |
| Self-hosted | Home icon | Full control on your infra — Docker, K8s, private cloud | "Contact Us" → /contact |

**Card structure:**
```
┌──────────────────┐
│ [Icon]            │
│ Tier Name         │
│ Description       │
│                   │
│ [CTA Button]      │
│ or [Link 1] [Link 2]
└──────────────────┘
```

- 3 columns, equal height
- Subtle border, dark bg cards on dark section
- Middle card (Pro) slightly elevated or highlighted
- Responsive: 3-col → 1-col

### 2. LandingFooter

**Structure:**
```
┌─────────────────────────────────────────┐
│ Logo          Product    Resources  Help │
│               Boards     Docs       FAQ  │
│               Agents     Blog       Support│
│               Gateways   Changelog  Contact│
│               Skills     API Ref         │
│─────────────────────────────────────────│
│ © 2026 OpenClaw. All rights reserved.   │
│ [GitHub] [Twitter/X] [Discord]          │
└─────────────────────────────────────────┘
```

- Dark bg (black or --slide-bg-alt)
- Muted text colors (--slide-muted)
- Social icons: Lucide icons (Github, Twitter, MessageCircle for Discord)
- Responsive: 4-col → 2-col → 1-col

### 3. Final Integration

Update landing-page.tsx with all sections in order:
```tsx
<ScrollProvider>
  <LandingNavbar />
  <main>
    <LandingHeroSection />      {/* Phase 1 */}
    <LogoMarquee />             {/* Phase 2 */}
    <FeatureCards />            {/* Phase 2 */}
    <ProductTabs />             {/* Phase 3 */}
    <TestimonialCarousel />     {/* Phase 3 */}
    <PricingCards />            {/* Phase 4 */}
    <LandingFooter />           {/* Phase 4 */}
  </main>
</ScrollProvider>
```

## Todo List
- [x] Create PricingCards with 3 tiers
- [x] Create LandingFooter with 4 columns
- [x] Wire all sections into landing-page.tsx
- [x] Add section IDs for navbar anchor links (#features, #product, #pricing)
- [x] Test full page scroll flow
- [x] Verify all CTAs link correctly

## Success Criteria
- All sections render in correct order
- Pricing cards display 3 tiers responsively
- Footer renders with all link columns
- Navbar anchor links scroll to correct sections
- Full page loads without errors

## Next Steps
- Phase 5: Polish, responsive fixes, accessibility audit

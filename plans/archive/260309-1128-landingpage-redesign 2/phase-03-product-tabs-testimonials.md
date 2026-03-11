# Phase 3: ProductTabs + TestimonialCarousel

## Overview
- **Priority:** P2
- **Status:** Complete
- **Effort:** 3h
- Tab interface showcasing product areas + testimonial carousel

## Key Insights
- CrewAI tabs: Orchestrate / Build / Observe / Manage — each with screenshot
- Helux equivalent: Boards / Agents / Gateways / Skills
- Each tab shows screenshot + feature tags
- Testimonials can use Swiper.js or Framer Motion carousel

## Related Code Files

### Create
| File | Path | Purpose |
|------|------|---------|
| product-tabs.tsx | `frontend/src/components/organisms/landing-page/product-tabs.tsx` | Tab interface with product screenshots |
| testimonial-carousel.tsx | `frontend/src/components/organisms/landing-page/testimonial-carousel.tsx` | Social proof carousel |

### Modify
| File | Change |
|------|--------|
| landing-page.tsx | Add ProductTabs + TestimonialCarousel sections |

## Implementation Steps

### 1. ProductTabs

**Section heading:** "The Mission Control Platform" (or "Everything You Need")

**Tabs:**
| Tab | Tags | Screenshot |
|-----|------|-----------|
| Boards | Tasks, Approvals, Realtime | Board list/detail view |
| Agents | Workflows, Health, Logs | Agent dashboard |
| Gateways | Routing, Config, Webhooks | Gateway detail |
| Skills | Packs, Marketplace, Deploy | Skills marketplace |

**Structure:**
```tsx
// Tab bar: horizontal buttons with active indicator
// Content: fade transition between tab panels
// Each panel: icon + tag badges + screenshot image
```

- Use `useState` for active tab
- Framer Motion `AnimatePresence` for tab content transitions
- Tags as small rounded badges above screenshot
- Screenshot: use Next.js `Image` with placeholder (or actual captures)
- Dark background section

### 2. TestimonialCarousel

**Options (choose one):**
- **Option A: Framer Motion carousel** — simpler, no new dependency
- **Option B: Swiper.js** — more features (autoplay, pagination, touch swipe)

**Recommend Option A** to avoid new dependency. Framer Motion `drag` prop handles swipe.

**Structure:**
```
"Loved by teams worldwide"
┌─────────────────────────────┐
│ "Quote text here..."        │
│                             │
│ — Author Name, Role, Company│
└─────────────────────────────┘
    ○ ○ ● ○ ○  (dots)
```

- Placeholder testimonials (3-5 items)
- Auto-advance every 5s (optional)
- Manual navigation via dots or swipe
- Dark/alternate bg section

**Placeholder content:**
```
1. "OpenClaw unified our board operations. Approvals that took days now take minutes."
   — Engineering Lead

2. "The agent health dashboard gives us real-time visibility we never had before."
   — DevOps Manager

3. "Finally, one place to track tasks, agents, and decisions across all our teams."
   — CTO
```

## Todo List
- [x] Create ProductTabs with 4 tabs
- [x] Add tab content transitions (AnimatePresence)
- [x] Create/source product screenshots (placeholder or real captures)
- [x] Create TestimonialCarousel with Framer Motion drag
- [x] Add placeholder testimonial content
- [x] Wire into landing-page.tsx
- [x] Test tab switching animations
- [x] Test carousel swipe on mobile

## Success Criteria
- Tabs switch smoothly with content fade
- Screenshots display correctly per tab
- Carousel supports swipe + dot navigation
- Responsive: tabs stack vertically on mobile

## Risk Assessment
- **Screenshots**: May need real captures from app — use placeholder images initially
- **Carousel perf**: Keep DOM minimal, only render visible + adjacent slides

## Next Steps
- Phase 4 adds PricingCards and Footer

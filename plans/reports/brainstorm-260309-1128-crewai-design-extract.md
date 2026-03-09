# CrewAI Design Extract — Landing Page Redesign for Helux

## Problem Statement

Helux landing page hiện dùng fullscreen slideshow (5 slides, Framer Motion). Cần chuyển sang long-scroll single-page giống CrewAI để tăng conversion, SEO, và trải nghiệm user.

## CrewAI Design System Extract

### Page Structure (10 Sections)

```
┌─────────────────────────────────────────┐
│  NAVBAR (fixed, transparent → solid)    │
│  Logo | Menu links | Sign in | Sign up  │
├─────────────────────────────────────────┤
│  HERO (100vh)                           │
│  Video background + dark overlay        │
│  Centered headline (GSAP split-text)    │
│  Subtext + 3 CTAs (row)                 │
├─────────────────────────────────────────┤
│  LOGO MARQUEE                           │
│  "Loved by AI builders..."             │
│  ← infinite scroll brand logos →        │
├─────────────────────────────────────────┤
│  VALUE PROP                             │
│  Description paragraph + CTA            │
├─────────────────────────────────────────┤
│  FEATURES (3 cards)                     │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ Easy │ │Trust │ │Scale │           │
│  │ img  │ │ img  │ │ img  │           │
│  │ 3pts │ │ 3pts │ │ 3pts │           │
│  └──────┘ └──────┘ └──────┘           │
├─────────────────────────────────────────┤
│  SOCIAL PROOF IMAGE                     │
│  Large image + 2 CTAs                   │
├─────────────────────────────────────────┤
│  PLATFORM TABS                          │
│  "Agent Management Platform"            │
│  [Orchestrate|Build|Observe|Manage]     │
│  Screenshot per tab                     │
├─────────────────────────────────────────┤
│  CASE STUDIES                           │
│  Swiper carousel testimonials           │
├─────────────────────────────────────────┤
│  GETTING STARTED (3 cards)              │
│  Cloud | Factory | OSS                  │
│  Icon + desc + action links             │
├─────────────────────────────────────────┤
│  FOOTER                                 │
│  4 cols: Explore|Resources|Help|News    │
│  Social links + copyright               │
└─────────────────────────────────────────┘
```

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#000000` | Page background, hero |
| `bg-white` | `#FFFFFF` | Alternate sections |
| `text-primary` | `#FFFFFF` | On dark backgrounds |
| `text-dark` | `#0F172A` | On light backgrounds |
| `btn-primary-bg` | `white/95` | Primary CTA |
| `btn-secondary-bg` | `white/10` | Secondary CTA |
| `btn-border` | `white/30` | Button borders |
| `overlay` | `black/30` | Video overlay |
| `disabled` | `#AFAFAF` | Disabled state |
| `error` | `#FF0000` | Error borders |

### Typography

| Element | Size | Weight | Style |
|---------|------|--------|-------|
| Hero headline | `clamp(44px, 9vw, 128px)` | Bold | `leading-[0.9] tracking-tight` |
| Section heading | `~36-48px` | Bold | Sans-serif |
| Sub heading | `~24-30px` | Semibold | |
| Body text | `clamp(14px, 1.3vw, 20px)` | Normal | `max-w-[800px]` |
| Meta text | `13px` | Normal | Muted color |
| Button text | `14px` | Semibold | |

### Button Styles

```
Primary:   rounded-full | border white/30 | bg-white/95 | text-black
           hover:bg-white | px-6 py-3 | text-sm font-semibold
           + arrow SVG icon

Secondary: rounded-full | border white/30 | bg-white/10 | text-white
           hover:bg-white/20 | px-6 py-3 | text-sm font-semibold
           + arrow SVG icon

Disabled:  opacity-0.5 | cursor-not-allowed | pointer-events-none
```

### Animation System

| Type | Library | Config |
|------|---------|--------|
| Smooth scroll | Lenis | `lerp: 0.1, duration: 1.2` |
| Text reveal | GSAP SplitText | Lines: 1.5s, Words: 0.6s, Chars: 0.4s |
| Scroll trigger | GSAP ScrollTrigger | Trigger: "top 80%" |
| Carousel | Swiper.js | Speed: 750ms |
| Page transitions | Framer Motion* | Already in Helux |

### Component Patterns

**Feature Card:**
```
┌──────────────────┐
│ [Image/Screenshot]│
│                   │
│ Title (h3, bold)  │
│ Description       │
│                   │
│ ○ Feature 1       │  (icon + text)
│ ○ Feature 2       │
│ ○ Feature 3       │
└──────────────────┘
```

**Platform Tab:**
```
[ Tab1 | Tab2 | Tab3 | Tab4 ]
┌────────────────────────┐
│ Icon + Tag badges      │
│ Planning|Reasoning|... │
│                        │
│ [Screenshot image]     │
└────────────────────────┘
```

**Logo Marquee:**
- Infinite scroll horizontal
- Duplicated logo set for seamless loop
- SVG logos, grayscale/white on dark bg

**Getting Started Card:**
```
┌──────────────────┐
│ [Icon]            │
│ Product Name      │
│ Description       │
│                   │
│ [Link 1] [Link 2]│
└──────────────────┘
```

### Responsive Breakpoints

| Name | Width | Notes |
|------|-------|-------|
| Mobile | ≤479px | Stack everything vertical |
| Tablet | 480-767px | 2-col grids |
| Desktop-sm | 768-991px | Transition layout |
| Desktop | ≥992px | Full layout |

---

## Adaptation for Helux (OpenClaw)

### Mapping CrewAI → Helux Sections

| CrewAI Section | Helux Equivalent | Content |
|---------------|-----------------|---------|
| Hero | Hero | Video bg + "Run Every Board in One Place" + CTAs |
| Logo Marquee | Trust Bar | Partner/client logos (nếu có) hoặc tech logos |
| Features 3-cards | Core Features | Easy setup / Trusted workflows / Scalable ops |
| Platform Tabs | Product Showcase | Boards / Agents / Gateways / Skills tabs |
| Case Studies | Testimonials | Quotes hoặc stats |
| Getting Started | Pricing/Plans | Cloud / Self-hosted / OSS tiers |
| Footer | Footer | Links + social + newsletter |

### Key Decisions

1. **Keep Framer Motion** — không cần migrate sang GSAP. Framer Motion đủ mạnh cho text reveals + scroll animations
2. **Add Lenis** — cho smooth scroll experience
3. **Reuse existing slide-1 hero** — adapt từ fullscreen sang hero section
4. **Dark theme dominant** — giữ black bg như hiện tại, alternate white sections cho features

### What to Keep from Current Helux

- HLS video component (slide-1)
- Animated text components (BlurReveal, SlideUpLine)
- Logo component
- Auth integration (Clerk)
- CSS variables (--slide-muted, --slide-divider)

### What to Remove

- Slideshow navigation (NavigationDots)
- Slide 2-5 (convert nội dung thành scroll sections)
- Framer AnimatePresence slide transitions
- Keyboard arrow navigation for slides

### New Components Needed

1. `LandingNavbar` — fixed transparent navbar
2. `LogoMarquee` — infinite scroll brand logos
3. `FeatureCards` — 3-column feature showcase
4. `ProductTabs` — tab interface with screenshots
5. `TestimonialCarousel` — Swiper-based testimonials
6. `PricingCards` — getting started tiers
7. `LandingFooter` — 4-column footer
8. `ScrollReveal` — reusable scroll-triggered animation wrapper

---

## Risks & Considerations

- **SEO improvement**: Long-scroll page = more content for crawlers vs hidden slides
- **Performance**: Lazy load sections below fold, keep video only in hero
- **Mobile**: Test smooth scroll on mobile (Lenis has known iOS issues)
- **Migration**: Can keep slide content as section content, minimal rewrite

## Next Steps

1. Create implementation plan with phases
2. Phase 1: Navbar + Hero (reuse slide-1)
3. Phase 2: Logo marquee + Feature cards
4. Phase 3: Product tabs + Testimonials
5. Phase 4: Pricing + Footer
6. Phase 5: Animations + polish

## Unresolved Questions

1. Helux có client/partner logos để dùng cho logo marquee không? Hay dùng tech stack logos?
2. Screenshots cho product tabs lấy từ đâu? Capture từ app hiện tại?
3. Testimonials content từ đâu? Placeholder hay real quotes?
4. Có cần pricing section không hay chỉ "Get Started" cards?

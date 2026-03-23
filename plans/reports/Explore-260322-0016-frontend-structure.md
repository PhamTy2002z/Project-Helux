# Frontend Codebase Exploration Report

**Date:** 2026-03-22 | **Project:** VisgniteAI | **CWD:** /Users/typham/Dev/VisgniteAI/frontend

---

## 1. Directory Structure Overview

```
frontend/
├── src/
│   ├── app/                    # Next.js 16 App Router
│   │   ├── layout.tsx          # Root layout with fonts, providers
│   │   ├── globals.css         # Global Tailwind styles
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   ├── loading.tsx
│   │   └── (app)/              # Protected app routes [39 dirs]
│   │       ├── dashboard/
│   │       ├── boards/
│   │       ├── agents/
│   │       ├── gateways/
│   │       ├── board-groups/
│   │       ├── tags/
│   │       ├── custom-fields/
│   │       ├── skills/
│   │       ├── approvals/
│   │       └── [more routes...]
│   │   └── (public)/            # Public routes
│   │       └── blog/
│   ├── components/             # 141 files, structured hierarchy
│   │   ├── ui/                 # Base UI components (17 files)
│   │   ├── atoms/              # Atomic components (10 files)
│   │   ├── molecules/          # Composite components (4 files)
│   │   ├── organisms/          # Complex components (43 files)
│   │   ├── providers/          # React context providers (5 files)
│   │   ├── templates/          # Page layouts
│   │   ├── tables/             # DataTable components
│   │   ├── charts/             # Chart components
│   │   ├── boards/             # Board feature (5 files)
│   │   ├── agents/             # Agent feature (5 files)
│   │   ├── gateways/           # Gateway feature (2 files)
│   │   ├── custom-fields/      # Custom field components (6 files)
│   │   ├── auth/               # Auth UI (login, sign-in)
│   │   ├── activity/           # Activity feed
│   │   ├── billing/            # Billing UI
│   │   ├── skills/             # Skills marketplace
│   │   ├── tags/               # Tags management
│   │   └── onboarding/         # Onboarding flow
│   ├── api/
│   │   ├── generated/          # Auto-generated Orval client [30 subdirs]
│   │   │   ├── boards/
│   │   │   ├── agents/
│   │   │   ├── gateways/
│   │   │   ├── tasks/
│   │   │   ├── board-chat-sessions/
│   │   │   ├── metrics/
│   │   │   ├── approvals/
│   │   │   ├── custom-fields/
│   │   │   ├── [more modules...]
│   │   │   └── model/          # Generated TypeScript models
│   │   └── mutator.ts          # Custom Axios mutator (auth, errors)
│   ├── auth/                   # Auth layer (11 files)
│   │   ├── mode.ts             # Auth mode detection
│   │   ├── clerk.tsx           # Clerk provider wrapper
│   │   ├── localAuth.ts        # Local bearer token auth
│   │   ├── profile.ts          # User profile helpers
│   │   └── [redirects, keys, tests]
│   ├── hooks/                  # Custom hooks (2 files)
│   │   └── usePageActive.ts    # Page visibility hook
│   ├── lib/                    # Utility functions (40 files, ~31 .ts files)
│   │   ├── api-base.ts         # API base URL resolution
│   │   ├── api-base-server.ts  # Server-side API
│   │   ├── query-policy.ts     # React Query refresh policies
│   │   ├── use-organization-membership.ts
│   │   ├── use-url-sorting.ts  # URL-based table sorting
│   │   ├── backoff.ts          # Exponential backoff utility
│   │   ├── billing.ts          # Billing helpers
│   │   ├── datetime.ts         # Date/time formatters
│   │   ├── formatters.ts       # Display formatters
│   │   ├── gateway-form.ts     # Gateway form validation
│   │   ├── onboarding.ts       # Onboarding state
│   │   ├── seo.ts             # SEO metadata
│   │   └── [more utilities]
│   ├── proxy.ts                # Next.js development proxy
│   └── setupTests.ts           # Vitest setup
├── public/
│   └── images/
│       └── brand/
├── cypress/                    # E2E tests
├── scripts/
│   ├── collect-route-bundle-metrics.mjs
│   ├── perf-budget-check.mjs
│   └── query-policy-guard-check.mjs
├── plans/                      # Planning & reports directory
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.cjs
├── vitest.config.ts
├── vitest.full-coverage.config.ts
├── eslint.config.mjs
├── orval.config.ts             # Code generation config
├── cypress.config.ts
├── Dockerfile                  # Docker for containerization
└── README.md
```

---

## 2. Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | Next.js | 16.1.6 | Server-rendered React with App Router |
| **React** | React | 19.2.4 | UI library |
| **Language** | TypeScript | 5.x | Type safety |
| **State** | TanStack React Query | 5.90.21 | Server state, caching, sync |
| **Tables** | TanStack React Table | 8.21.3 | Headless table component |
| **Styling** | Tailwind CSS | 3.4.19 | Utility-first CSS |
| **UI Components** | Radix UI | Latest | Unstyled, accessible components |
| **Auth** | Clerk | 6.37.3 | SaaS auth (+ local token mode) |
| **Icons** | Lucide React | 0.563.0 | SVG icon library |
| **Animation** | Framer Motion | 12.35.1 | Motion library |
| **Charts** | Recharts | 3.7.0 | React charting library |
| **Markdown** | React Markdown | 10.1.0 | Markdown rendering |
| **Testing** | Vitest | 4.0.18 | Unit/component tests |
| **E2E Testing** | Cypress | 14.5.4 | End-to-end browser testing |
| **Linting** | ESLint | 9.x | Code quality |
| **Formatting** | Prettier | 3.8.1 | Code formatting |
| **API Client** | Orval + Axios | 8.3.0 + auto | Generated OpenAPI-typed client |

### CSS & Design System
- **Tailwind CSS** 3.4.19 with `tailwindcss-animate` plugin
- **Dark mode** via class strategy (`darkMode: ["class"]`)
- **Font families:** IBM Plex Sans (body), Sora (heading), DM Serif Display (display)
- **Custom screens:** `fhd` (1920px), `qhd` (2560px), `uhd` (3840px)
- **Custom animations:** Typing dots animation for chat UI

---

## 3. Key Pages & Routes

### App Routes (Protected)

| Route | Path | Purpose |
|-------|------|---------|
| **Dashboard** | `/dashboard` | Main overview, metrics, activity feed |
| **Boards** | `/boards` | List/manage task boards |
| **Board Detail** | `/boards/[boardId]` | View/edit board, tasks, chat panel |
| **Board Approvals** | `/boards/[boardId]/approvals` | Approval workflows |
| **Board Webhooks** | `/boards/[boardId]/webhooks/[webhookId]/payloads` | Webhook payload history |
| **Agents** | `/agents` | List/manage AI agents |
| **Agent Detail** | `/agents/[agentId]` | View/configure agent |
| **Gateways** | `/gateways` | API gateway management |
| **Board Groups** | `/board-groups` | Organize boards into groups |
| **Custom Fields** | `/custom-fields` | Define custom task fields |
| **Tags** | `/tags` | Manage task tags |
| **Skills** | `/skills/marketplace` | Skill discovery & management |
| **Activity** | `/activity` | Historical activity log |
| **Approvals** | `/approvals` | Organization-wide approvals |
| **Settings** | `/settings` | User/org settings |
| **Organization** | `/organization` | Org info & members |
| **Checkout** | `/checkout/success` | Billing success page |
| **Invite** | `/invite` | Team invite handling |
| **Onboarding** | `/onboarding` | Setup wizard |

### Public Routes
- `/blog` – Blog posts

---

## 4. Routing & Layout Structure

**Pattern:** Next.js 13+ App Router with route groups

```
(app) ──────────────────── Authenticated app routes
  └─ layout.tsx (AuthProvider, QueryProvider)
     ├─ dashboard/
     ├─ boards/[boardId]/
     │   ├─ approvals/
     │   └─ webhooks/[webhookId]/payloads/
     ├─ agents/[agentId]/
     ├─ gateways/[gatewayId]/
     └─ [more routes...]

(public) ─────────────────── Public routes
  └─ blog/

layout.tsx ──────────────── Root layout
  ├─ Font loading (IBM Plex Sans, Sora, DM Serif Display)
  ├─ ThemeProvider
  ├─ Metadata/SEO setup
  └─ Dev Agentation tool (dev only)
```

### Layout Hierarchy
1. **Root layout** (`src/app/layout.tsx`): Fonts, globals, theme, metadata
2. **App group layout** (`src/app/(app)/layout.tsx`): AuthProvider, QueryProvider, GlobalLoader
3. **Individual pages** (e.g., `boards/[boardId]/page.tsx`): Use client components with data fetching

---

## 5. Configuration Files

### Next.js Config (`next.config.ts`)
- **Output:** Standalone (Docker-friendly)
- **Dev origins:** `192.168.1.101`, `localhost`, `127.0.0.1`
- **Image optimization:** AVIF + WebP formats, srcset qualities [75, 96]
- **Clerk image proxy:** Remote pattern for `img.clerk.com`
- **Experimental:** Package import optimization for `lucide-react`, `recharts`, `framer-motion`, `@tanstack/react-table`

### TypeScript (`tsconfig.json`)
- **Target:** ES2017
- **Module:** ESNext
- **Strict mode:** Enabled
- **Path alias:** `@/*` → `./src/*`
- **Vitest globals:** Enabled with `@testing-library/jest-dom`

### Tailwind (`tailwind.config.cjs`)
- **Dark mode:** Class-based
- **Excluded:** Generated API files (`!./src/api/generated/**/*`)
- **Custom font families:** heading, body, display via CSS variables
- **Custom screens:** fhd, qhd, uhd
- **Animation plugins:** `tailwindcss-animate`

### Orval (`orval.config.ts`)
- **Input:** `ORVAL_INPUT` env var or `http://127.0.0.1:8000/openapi.json`
- **Output:** `src/api/generated/*`
- **Client:** React Query hooks + Axios
- **Mutator:** Custom (`src/api/mutator.ts`) for auth header injection

---

## 6. Component Architecture

### UI Component Layers

**Atomic Design Pattern:**
- **UI (Base):** `badge`, `button`, `card`, `input`, `dialog`, `select`, `tabs`, `tooltip`, etc.
  - Built on **Radix UI** primitives (unstyled, accessible)
  - Tailwind-styled variants using `class-variance-authority`
- **Atoms:** Small, reusable components (LazyMarkdown, etc.)
- **Molecules:** Small composite components (4 files)
- **Organisms:** Complex features (43 files)
  - `TaskBoard.tsx` – Main task board component
  - `UserMenu.tsx` – User profile menu
  - `DashboardSidebar.tsx` – Sidebar navigation
  - `LocalAuthLogin.tsx` – Local auth form
  - Landing slideshow components

### Feature Components
- **Boards** (5): BoardsTable, BoardForm, BoardDetail
- **Agents** (5): AgentList, AgentForm, AgentDetail
- **Gateways** (2): GatewayForm, GatewayDetail
- **Custom Fields** (6): Field editor/renderers
- **Tables** (2): DataTable (with sorting, pagination), cell formatters
- **Charts** (3): Generic chart wrapper, sparklines, theme

### Providers (Context)
1. **ThemeProvider** – Dark/light mode toggle
2. **AuthProvider** – Clerk or local auth state
3. **QueryProvider** – React Query client setup
4. **PublicAuthProvider** – Public page auth
5. **ScrollProvider** – Smooth scroll behavior (Lenis)

---

## 7. API & Data Fetching

### Generated API Client (Orval)
- **Source:** Backend OpenAPI schema
- **Location:** `src/api/generated/*/` (30 modules)
- **Pattern:** React Query hooks (e.g., `useListBoardsApiV1BoardsGet`)
- **Axios mutator:** Custom (`src/api/mutator.ts`)
  - Auto-injects `Authorization: Bearer <token>` (Clerk or local)
  - Auto-sets `Content-Type: application/json`
  - Parses errors into `ApiError` with status + body

### Key API Modules
| Module | Purpose |
|--------|---------|
| `boards` | Board CRUD & list |
| `agents` | Agent management |
| `gateways` | Gateway status/config |
| `tasks` | Task operations |
| `board-chat-sessions` | Chat history |
| `metrics` | Dashboard metrics |
| `approvals` | Approval workflows |
| `activity` | Activity feed |
| `custom-fields` | Field definitions |
| `board-onboarding` | Onboarding state |
| `board-memory` | Board memory/context |
| `skills-marketplace` | Skill discovery |

### Query Management
- **React Query v5:** Server state, caching, background sync
- **Query policies:** `visibilityAwareInterval`, `withQueryPolicy` (page visibility aware)
- **Page activity hook:** `usePageActive()` pauses queries on page blur
- **Optimistic updates:** `createOptimisticListDeleteMutation` helper
- **URL-based sorting:** `useUrlSorting` syncs table state to URL params

---

## 8. Authentication

### Modes
1. **Local mode** (default, self-hosted)
   - Shared bearer token stored in localStorage
   - `src/auth/localAuth.ts` – Token management
   - UI: `LocalAuthLogin.tsx` form

2. **Clerk mode** (SaaS)
   - `@clerk/nextjs` integration
   - Clerk session → auto JWT in API requests
   - Sign-in/sign-out via Clerk dashboard
   - `src/auth/clerk.tsx` – Clerk provider wrapper

### Auth Utilities
- `src/auth/mode.ts` – Detect mode from env
- `src/auth/profile.ts` – User profile helpers
- `src/auth/redirects.ts` – Auth-based redirects
- `useOrganizationMembership()` – Org role checks
- Hook: `useAuth()` from `@clerk/nextjs` or local mode

---

## 9. Testing Strategy

### Test Files
- **Total test files:** 40 across codebase
- **Test framework:** Vitest 4.0.18 + jsdom
- **Coverage:** 100% required for explicitly listed modules
  - `src/lib/backoff.ts` – Retry logic
  - `src/components/activity/ActivityFeed.tsx` – Activity component

### Test Coverage Files
- `src/lib/` tests: `backoff.test.ts`, `billing.test.ts`, `display-name.test.ts`, etc.
- Component tests: `DataTable.test.tsx`, `UserMenu.test.tsx`, `LocalAuthLogin.test.tsx`
- Page tests: `activity/page.test.tsx`
- E2E: `cypress/` directory with Cypress runner

### Setup
- **vitest.config.ts:** jsdom environment, globals enabled, LCOV reporter
- **setupTests.ts:** Test environment initialization
- **@testing-library/*:** React, user-event, jest-dom matchers

---

## 10. Notable Patterns & Recent Changes

### Patterns
- **Query policy gates:** Check query policy headers (prevents excessive refetches)
- **SSE streaming:** For agent responses, board chat (see `sse-parser.ts`)
- **Optimistic updates:** UI updates before server confirmation
- **URL-synced state:** Table sorting, filters stored in URL params
- **Feature gates:** Conditional rendering based on plan/subscription

### Recent Changes (Last 20 commits)
| Change | Type | Impact |
|--------|------|--------|
| Board chat panel rendering optimization | perf | Reduced re-renders, message handling |
| Agent SSE stream for chat loading | fix | Proper loading indicator for streaming |
| Landing page UI improvements | style | Enhanced CTA, new sections |
| Docker: alpine → slim | fix | SWC compatibility |
| Gateway RPC retry with backoff | fix | Transient error handling |
| Hero: video → CSS background | feat | Performance optimization |
| Brand rename: FlowGrid → VisgniteAI | refactor | Codebase consistency |
| ESLint warnings in hooks | fix | Deps array validation |

---

## 11. File Counts & Metrics

| Directory | Files | LOC (est.) | Purpose |
|-----------|-------|-----------|---------|
| `api/generated/` | 343 | ~50k | Auto-generated API client |
| `components/` | 141 | ~15k | UI & feature components |
| `app/(app)/` | 78 | ~8k | App pages & layouts |
| `lib/` | 40 | ~4k | Utilities & helpers |
| `auth/` | 11 | ~1.5k | Auth layer |
| **Total src/ts(x)** | **617** | **~42.4k** | All TypeScript files |

---

## 12. Key Configuration

### Environment Variables
```
NEXT_PUBLIC_API_URL=auto              # Backend API URL (or 'auto')
NEXT_PUBLIC_AUTH_MODE=local|clerk     # Auth mode
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=... # Clerk key (if using Clerk)
```

### Build Commands
- `npm run dev` – Dev server (with auto-proxy to backend)
- `npm run build` – Production build
- `npm run api:gen` – Regenerate types from OpenAPI schema
- `npm run test` – Vitest with coverage
- `npm run lint` – ESLint check
- `npm run perf:collect` – Bundle metric collection
- `npm run query-policy:check` – Query policy validation

---

## Summary

**VisgniteAI frontend** is a **Next.js 16 + React 19** SaaS dashboard with:

- **Architecture:** Atomic component design + Next.js App Router
- **State:** React Query for server state, Clerk/local for auth
- **Styling:** Tailwind CSS + Radix UI + Framer Motion animations
- **API:** Auto-generated Orval client from backend OpenAPI schema
- **Testing:** Vitest with jsdom, 100% coverage gates on key modules
- **Scale:** 617 TS/TSX files, 124 directories, ~42.4k LOC
- **Features:** Boards, agents, gateways, approvals, custom fields, chat, metrics

**Key strengths:**
1. Type-safe API client (auto-generated)
2. React Query for cache management & sync
3. Accessibility-first UI (Radix primitives)
4. Dark/light mode out-of-box
5. Responsive design (mobile-first)
6. Flexible auth (Clerk + local bearer token)

**Tech maturity:** Production-ready with recent optimizations (perf, streaming, responsive chat).

---

**Unresolved Questions:**
- Is there documentation on feature gates/plan tiers?
- Are there specific performance budget targets? (perf scripts suggest yes)
- What's the board chat panel's exact architecture (server-sent events vs polling)?

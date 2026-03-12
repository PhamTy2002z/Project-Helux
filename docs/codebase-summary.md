# Codebase Summary

## Overview

OpenClaw Mission Control is a full-stack web application with FastAPI backend, Next.js frontend, and Docker-based deployment. The codebase is organized as a monorepo with clear separation between backend, frontend, and infrastructure concerns.

## Repository Statistics

### Backend (Python)
- **Total Python Files**: ~1,899 files
- **Core Application Files**: ~150 files (excluding migrations, tests, cache)
- **API Routes**: 28 route modules
- **Database Models**: 38 SQLModel models
- **Service Modules**: 18 core services + 20+ OpenClaw integration services
- **Primary Language**: Python 3.12
- **Framework**: FastAPI 0.131.0

### Frontend (TypeScript/React)
- **Total TypeScript Files**: ~411 files
- **Pages**: 40+ routes using Next.js App Router
- **Components**: 200+ React components
- **API Client Modules**: 26 generated API endpoints
- **Primary Language**: TypeScript 5
- **Framework**: Next.js 16.1.6, React 19.2.4

### Infrastructure
- **Docker Services**: 5 (db, redis, backend, frontend, webhook-worker)
- **Configuration Files**: 15+ (Docker, CI/CD, linting, testing)
- **Documentation Files**: 20+ markdown files
- **Install Script**: 1,000+ lines comprehensive installer

## Technology Stack

### Backend Stack
```
FastAPI (0.131.0)          - Web framework
SQLModel (0.0.32)          - ORM with Pydantic integration
SQLAlchemy (2.0.46)        - Database toolkit
Alembic (1.18.3)           - Database migrations
PostgreSQL (psycopg 3.3.2) - Primary database
Redis (6.3.0)              - Caching and job queue
RQ (2.6.0)                 - Job queue worker
Clerk Backend API (4.2.0)  - Authentication (optional)
Uvicorn (0.40.0)           - ASGI server
Pydantic Settings (2.12.0) - Configuration management
SSE Starlette (3.2.0)      - Server-sent events
WebSockets (16.0)          - Real-time communication
```

### Frontend Stack
```
Next.js (16.1.6)           - React framework
React (19.2.4)             - UI library
TypeScript (5)             - Type safety
TanStack Query (5.90.21)   - Data fetching and caching
TanStack Table (8.21.3)    - Table components
Radix UI                   - Headless UI components
Tailwind CSS (3.4.19)      - Utility-first CSS
Clerk Next.js (6.37.3)     - Authentication (optional)
Orval (8.3.0)              - API client generation
Vitest (4.0.18)            - Testing framework
Cypress (14.5.4)           - E2E testing
Recharts (3.7.0)           - Data visualization
```

### Infrastructure Stack
```
Docker Engine              - Containerization
Docker Compose v2          - Multi-container orchestration
PostgreSQL 14+             - Database server
Redis 6+                   - Cache and queue server
GitHub Actions             - CI/CD pipeline
```

## Directory Structure

### Root Level
```
/
├── backend/               # FastAPI backend application
├── frontend/              # Next.js frontend application
├── docs/                  # Documentation
├── migrations/            # Database migrations (Alembic)
├── .github/               # GitHub Actions workflows
├── compose.yml            # Docker Compose configuration
├── install.sh             # Comprehensive installation script
├── .env.example           # Environment template
└── README.md              # Project overview
```

### Backend Structure
```
backend/
├── app/
│   ├── api/               # API route handlers (24 modules)
│   │   ├── activity.py
│   │   ├── agent.py       # Primary agent operations (69KB)
│   │   ├── agents.py
│   │   ├── approvals.py
│   │   ├── auth.py
│   │   ├── board_groups.py
│   │   ├── board_memory.py
│   │   ├── board_onboarding.py
│   │   ├── board_webhooks.py
│   │   ├── boards.py
│   │   ├── gateways.py
│   │   ├── gateway.py
│   │   ├── metrics.py
│   │   ├── organizations.py
│   │   ├── skills_marketplace.py (45KB)
│   │   ├── souls_directory.py
│   │   ├── tags.py
│   │   ├── task_custom_fields.py
│   │   ├── tasks.py       # Primary task operations (86KB)
│   │   ├── users.py
│   │   └── deps.py        # Dependency injection
│   ├── core/              # Core utilities
│   │   ├── config.py      # Settings management
│   │   ├── security.py    # Auth and security
│   │   └── logging.py     # Logging configuration
│   ├── db/                # Database configuration
│   │   ├── session.py     # Async session management
│   │   └── base.py        # Base model imports
│   ├── models/            # SQLModel database models (38 models)
│   │   ├── activity_events.py
│   │   ├── agent_token_daily_usage.py
│   │   ├── agents.py
│   │   ├── approvals.py
│   │   ├── approval_task_links.py
│   │   ├── billing_checkout_attempts.py
│   │   ├── board_chat_file_assets.py
│   │   ├── board_chat_file_reports.py
│   │   ├── board_chat_file_tasks.py
│   │   ├── board_chat_message_files.py
│   │   ├── board_chat_sessions.py
│   │   ├── board_groups.py
│   │   ├── board_group_memory.py
│   │   ├── board_memory.py
│   │   ├── board_onboarding.py
│   │   ├── board_webhooks.py
│   │   ├── board_webhook_payloads.py
│   │   ├── boards.py
│   │   ├── gateways.py
│   │   ├── organizations.py
│   │   ├── organization_members.py
│   │   ├── organization_invites.py
│   │   ├── organization_board_access.py
│   │   ├── organization_plans.py
│   │   ├── skills.py
│   │   ├── tags.py
│   │   ├── tag_assignments.py
│   │   ├── task_custom_fields.py
│   │   ├── task_dependencies.py
│   │   ├── task_fingerprints.py
│   │   ├── task_groups.py
│   │   ├── tasks.py
│   │   ├── tenancy.py
│   │   ├── user_onboarding_progress.py
│   │   └── users.py
│   ├── schemas/           # Pydantic schemas (30 modules)
│   │   └── [request/response schemas]
│   ├── services/          # Business logic (18+ modules)
│   │   ├── activity_log.py
│   │   ├── admin_access.py
│   │   ├── approval_task_links.py
│   │   ├── board_group_snapshot.py
│   │   ├── board_lifecycle.py
│   │   ├── board_snapshot.py
│   │   ├── lead_policy.py
│   │   ├── mentions.py
│   │   ├── organizations.py (19KB)
│   │   ├── queue.py
│   │   ├── queue_worker.py
│   │   ├── souls_directory.py
│   │   ├── tags.py
│   │   ├── task_dependencies.py
│   │   ├── openclaw/      # OpenClaw integration (20+ modules)
│   │   │   ├── gateway_rpc.py
│   │   │   ├── lifecycle_orchestrator.py
│   │   │   ├── provisioning.py
│   │   │   ├── provisioning_db.py
│   │   │   └── internal/
│   │   └── webhooks/      # Webhook handlers
│   └── main.py            # FastAPI application entry (19KB)
├── migrations/            # Alembic migrations
├── scripts/               # Utility scripts
├── tests/                 # Test suite
├── pyproject.toml         # Python dependencies
└── .env.example           # Backend environment template
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/               # Next.js App Router with route groups
│   │   ├── (app)/         # Protected routes (auth required)
│   │   │   ├── activity/
│   │   │   ├── agents/
│   │   │   │   └── [agentId]/
│   │   │   ├── approvals/
│   │   │   ├── boards/
│   │   │   │   ├── [boardId]/
│   │   │   │   └── new/
│   │   │   ├── board-groups/
│   │   │   │   ├── [groupId]/
│   │   │   │   └── new/
│   │   │   ├── custom-fields/
│   │   │   │   └── new/
│   │   │   ├── dashboard/
│   │   │   ├── gateways/
│   │   │   │   ├── [gatewayId]/
│   │   │   │   └── new/
│   │   │   ├── invite/
│   │   │   ├── onboarding/
│   │   │   ├── organization/
│   │   │   ├── settings/
│   │   │   ├── skills/
│   │   │   │   ├── marketplace/
│   │   │   │   └── packs/
│   │   │   ├── tags/
│   │   │   │   └── [tagId]/
│   │   │   └── layout.tsx
│   │   ├── (public)/      # Public routes (no auth required)
│   │   │   ├── sign-in/
│   │   │   └── layout.tsx
│   │   ├── api/           # API routes (server-side)
│   │   │   └── local-auth/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/        # React components (atomic design)
│   │   ├── atoms/         # Basic UI elements
│   │   ├── molecules/     # Composite components
│   │   ├── organisms/     # Complex components
│   │   ├── templates/     # Page templates
│   │   ├── ui/            # Radix UI wrappers
│   │   ├── activity/
│   │   ├── agents/
│   │   ├── approvals/
│   │   ├── auth/
│   │   ├── boards/
│   │   ├── board-groups/
│   │   ├── charts/
│   │   ├── gateways/
│   │   ├── organization/
│   │   ├── providers/
│   │   ├── skills/
│   │   ├── tables/
│   │   └── tags/
│   ├── lib/               # Utility libraries
│   │   ├── api/           # Generated API client (26 modules)
│   │   │   ├── activity/
│   │   │   ├── agents/
│   │   │   ├── approvals/
│   │   │   ├── auth/
│   │   │   ├── boards/
│   │   │   ├── board-groups/
│   │   │   ├── gateways/
│   │   │   ├── metrics/
│   │   │   ├── organizations/
│   │   │   ├── skills/
│   │   │   ├── tags/
│   │   │   ├── tasks/
│   │   │   └── users/
│   │   ├── api-base-server.ts # Server-side API base with auth handling
│   │   ├── api-base.ts    # Client-side API base
│   │   ├── sse-parser.ts  # Server-sent event buffer parser
│   │   ├── query-policy.ts # React Query default policies
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   └── auth/              # Authentication utilities
├── public/                # Static assets
├── cypress/               # E2E tests
├── tests/                 # Unit tests
├── orval.config.ts        # API client generation config
├── next.config.ts         # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── vitest.config.ts       # Vitest configuration
├── package.json           # Node.js dependencies
└── .env.example           # Frontend environment template
```

## Key Architectural Patterns

### Backend Patterns
- **Layered Architecture**: API → Services → Models
- **Dependency Injection**: FastAPI's Depends for database sessions and auth
- **Async/Await**: Fully async database operations with SQLAlchemy
- **Repository Pattern**: Service layer abstracts database operations
- **Schema Validation**: Pydantic schemas for request/response validation
- **Job Queue**: Redis RQ for async background tasks
- **Event Sourcing**: Activity events for audit trail

### Frontend Patterns
- **Atomic Design**: Components organized by complexity (atoms → templates)
- **Route Groups**: `(app)` and `(public)` route groups for protected/public separation
- **Server Components**: Next.js App Router with React Server Components
- **Client-Side State**: TanStack Query for server state management
- **Code Generation**: Orval generates API client from OpenAPI spec
- **SSE Streaming**: Consolidated `useSSEStream` hook with exponential backoff retry logic
- **SSE Parsing**: Reusable `parseSSEBuffer` for handling streamed events
- **Composition**: Radix UI primitives composed into custom components
- **Type Safety**: End-to-end TypeScript from API to UI

### Data Flow Patterns
- **API-First**: All operations go through REST API
- **Optimistic Updates**: UI updates before server confirmation
- **Real-Time Updates**: WebSocket for gateway communication + SSE streaming
- **Pagination**: Cursor-based pagination for large datasets (board tasks, chat messages)
- **Caching**: TanStack Query cache + Redis backend cache
- **Board Planning Overlay**: TaskGroup model + cursor pagination + feature-flagged UI with canary targeting
- **Multi-Session Chat**: Chat session CRUD + session-scoped SSE streaming + file upload pipeline

## Code Organization Principles

### File Naming
- **Backend**: snake_case for Python files
- **Frontend**: kebab-case for directories, PascalCase for components
- **Descriptive Names**: File names indicate purpose without reading content

### Module Size
- **Target**: < 200 lines per file for optimal context
- **Large Files**: agent.py (69KB), tasks.py (86KB), skills_marketplace.py (45KB)
- **Refactoring Opportunity**: Large API modules could be split into sub-routers

### Import Organization
- **Backend**: Standard library → Third-party → Local imports
- **Frontend**: React → Third-party → Local imports → Types
- **Absolute Imports**: Configured for both backend and frontend

### Testing Structure
- **Backend**: tests/ mirrors app/ structure
- **Frontend**: tests/ for unit tests, cypress/ for E2E
- **Coverage**: Backend target 80%, Frontend target 70%

## Key Dependencies and Versions

### Critical Backend Dependencies
- FastAPI 0.131.0 - Core web framework
- SQLModel 0.0.32 - ORM with Pydantic integration
- PostgreSQL psycopg 3.3.2 - Database driver
- Alembic 1.18.3 - Database migrations
- Redis 6.3.0 + RQ 2.6.0 - Job queue

### Critical Frontend Dependencies
- Next.js 16.1.6 - React framework with App Router
- React 19.2.4 - Latest React with concurrent features
- TanStack Query 5.90.21 - Server state management
- Orval 8.3.0 - API client generation
- Radix UI - Accessible component primitives

### Development Tools
- Black 26.1.0 - Python code formatting
- Ruff 0.15.0 - Python linting
- ESLint 9 - JavaScript/TypeScript linting
- Prettier 3.8.1 - Code formatting
- Vitest 4.0.18 - Unit testing
- Cypress 14.5.4 - E2E testing

## Build and Deployment

### Docker Build
- Multi-stage builds for optimized images
- Development and production configurations
- Health checks for all services
- Volume mounts for development hot-reload

### Local Development
- Backend: uvicorn with auto-reload
- Frontend: Next.js dev server with Turbopack
- Database: PostgreSQL in Docker or local
- Redis: Redis in Docker or local

### CI/CD Pipeline
- Linting and formatting checks
- Unit test execution with coverage
- E2E test execution
- Database migration validation
- Docker image building

## Key Observability Endpoints

### Telemetry & Metrics
- `/api/v1/metrics/board-overlay` - Board overlay latency, filter usage, cursor pagination stats, agent loop regression markers
- `/api/v1/metrics/quotas` - Token usage ledger aggregation per agent with plan tier
- `/api/v1/metrics/saas-billing-health` - Trial expiry, subscription status, entitlement enforcement events
- `/api/v1/metrics` - General system metrics endpoint
- `/api/v1/billing/support/timeline` - Billing event history for debugging
- `/api/v1/onboarding/progress/me` - Step-based onboarding checklist completion

### Feature Flags & Canary Targeting
- `board_planning_overlay_v1` - Board overlay UX rollout (board/org-level canary targeting)
- `board_query_v2` - New task query endpoint for cursor pagination

## Unresolved Questions

1. What is the actual LOC count with cloc tool?
2. Are there performance benchmarks for API endpoints?
3. What is the current test coverage percentage?
4. How many active contributors to the codebase?
5. What is the release cadence and versioning strategy?

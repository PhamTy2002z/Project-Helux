# Project Roadmap

## Current Status

**Version**: 0.1.0 (Active Development)
**Status**: Pre-release, under active development
**Last Updated**: 2026-03-21

## Recent Updates (March 2026)

- ✅ **Task review SLA automation + lead nudge hardening complete** (2026-03-21):
  - Added board-level `review_sla_minutes` configuration and task-level review tracking fields.
  - Added review SLA queue + worker to enforce review deadlines with retry backoff.
  - Added auto-reassign path from `review` to `inbox` after repeated missed review checks.
  - Added lead comment fallback routing so untagged lead review comments notify the last worker.
  - Added dashboard KPIs for review-overdue workload and median review wait.
  - Added tenant-SLO alert metric `review_sla_enqueue_failed_count` from activity events.
  - Added migration + regression tests for review tracking and worker behavior.

- ✅ **Billing & Polar Integration Hardening Complete** (2026-03-16):
  - Implemented store-then-process webhook pattern with `polar_webhook_events` table
  - Added async worker processing for Polar subscription lifecycle events
  - Hardened plan expiry check to block ALL tiers (pro + trial) when `effective_until` set
  - Added row-level locking via `SELECT FOR UPDATE` on concurrent plan modifications
  - Polar client now configurable with `server` param (sandbox/production) and 10s timeout
  - Polar customer_id reused for repeat checkouts with portal return_url support
  - Webhook payload stored before processing for audit/replay capability
  - Billing history records created ONLY on confirmed payment (idempotent by polar_subscription_id)
  - Subscription lifecycle handlers: active, canceled, uncanceled, updated, past_due, revoked
  - Metric renamed: `saas.trial.expired.blocked` → `saas.plan.expired.blocked`

- ✅ **Payment Flow UX Rework Complete** (2026-03-16):
  - Added Polar customer portal access endpoint (`GET /api/v1/billing/portal-session`)
  - Implemented billing email system with Resend (upgrade, trial warning, payment failure)
  - Redesigned upgrade modal with Pro-only layout and feature comparison
  - Added sidebar usage meter with quota visualization
  - Implemented new billing settings section with plan info and portal access
  - Added checkout success page with confetti and plan activation polling
  - Simplified settings page with billing component extraction

- [done] **Onboarding wizard question-first flow update** (2026-03-16):
  - Removed board-create and board-chat actions from onboarding wizard steps.
  - Reframed onboarding steps into guided questions and preferences capture.
  - Added custom use-case entry path (Other (custom)) with inline answer input.
  - Kept API step key compatibility while updating backend/frontend step titles.
  - Updated dashboard checklist step links to route users back to /onboarding.

- ✅ **Organization invite email rollout complete** (2026-03-15):
  - Added provider-gated invite delivery config (`EMAIL_PROVIDER`, Resend keys,
    sender identity, invite accept URL).
  - Added invite email domain layer + Resend adapter + deterministic
    idempotency key handling per send attempt.
  - Added async queue task `organization_invite_email_send` and worker handler
    integration with existing retry/backoff.
  - Added non-blocking enqueue in invite creation flow.
  - Added admin resend endpoint:
    `POST /api/v1/organizations/me/invites/{invite_id}/resend`.
  - Added organization UI resend action and frontend API hook integration for
    pending invites.
  - Added production compose env pass-through for invite email settings on both
    backend and webhook-worker services.
  - Added test coverage for config, sender, queue, worker, and invite API
    behavior.

- ✅ **Workspace Templates Feature Complete** (2026-03-13):
  - New `WorkspaceTemplate` model with JSONB file_contents (org-scoped, system seeds)
  - CRUD API endpoints: `GET /api/v1/workspace-templates`, `POST`, `PATCH`, `DELETE`
  - Backend service layer for template management and provisioning
  - Template picker UI on agent creation flow
  - 12 system seed templates auto-created on startup
  - Integration with agent provisioning pipeline via template writer service
  - Comprehensive research and feasibility documentation

- ✅ **SaaS Hardening & Payment Enforcement Complete** (2026-03-12):
  - Trial expiry blocks (402 blocked_for_payment response)
  - Board-group and agents-per-board quota enforcement
  - Entitlements service validation on write operations
  - Billing observability endpoints live

- ✅ Board planning overlay compatibility plan (`260311-2312`) phases 5-7 completed:
  - Added feature-flagged board overlay UX with URL-synced query state, saved
    views, grouped rendering, density modes, and done-lane compression.
  - Added overlay rollout controls and canary targeting for
    `board_planning_overlay_v1` and `board_query_v2`.
  - Added new telemetry endpoint `/api/v1/metrics/board-overlay` with latency,
    filter-usage, cursor-usage, and agent loop regression counters.
  - Added rollout runbook:
    `docs/operations/board-overlay-rollout-playbook.md`.
  - Added backend/frontend overlay regression tests and verified full check.
- ✅ Board planning overlay compatibility plan (`260311-2312`) phases 1-4 completed:
  - Contract matrix locked for OpenClaw compatibility-sensitive task-loop semantics
  - Added `TaskGroup` planning overlay model + migration and additive task fields (`task_group_id`, `sort_index`, `archived_at`)
  - Added additive task query filters and new cursor pagination route (`/api/v1/boards/{board_id}/tasks/cursor`)
  - Added optional compact board snapshot mode (`/api/v1/boards/{board_id}/snapshot?compact=true`)
  - Updated heartbeat/agent templates and agent OpenAPI hints for deterministic filtered task selection
  - Added contract + scaling + heartbeat-selection regression tests
- ✅ Landing page responsive hardening completed:
  - Added FHD/QHD/UHD width scaling rules for navbar, hero, feature cards, product tabs, testimonials, and footer
  - Hero video now degrades gracefully on mobile, reduced-motion, and save-data scenarios to preserve smoothness
  - Mobile navigation now locks body scroll and uses larger touch targets
  - Added landing regression tests for hero media policy and mobile drawer behavior
- ✅ Landing page feature section refresh:
  - Replaced the `One platform for every operational surface` placeholder cards with two poster-based spotlight cards
  - Integrated CrewAI `Trusted` and `Scalable` visuals into the current VisgniteAI landing page
  - Added component test coverage for the refreshed landing feature section
- ✅ Token ledger + quota enforcement plan (`260309-2123`) phases 4-6 completed first:
  - Backend agent read surfaces now expose token fields (`token_used_today`, `token_limit_today`, `token_remaining_today`, `token_blocked`, `token_reset_at`)
  - `/api/v1/metrics/quotas` token resources now derive from `agent_token_daily_usage` ledger with metadata fallback when ledger is empty
  - Agents UI now shows `Tokens left` column with blocked badge/reset hint
  - Plan-tier label normalization now displays `Basic` for `trial_7d` across shell/menu/settings/plan cards
  - Added backend API+service tests and frontend component tests for new token/quota surfaces
- ✅ Landing page redesign plan (`260309-1128`) all phases completed:
  - Converted fullscreen slideshow to CrewAI-inspired long-scroll landing page
  - 11 new UI components created: ScrollProvider, LandingNavbar, LandingHeroSection, ScrollReveal, LogoMarquee, FeatureCards, ProductTabs, TestimonialCarousel, PricingCards, LandingFooter, LandingPage orchestrator
  - Added Lenis smooth scroll library with responsive navbar transition
  - Implemented Framer Motion scroll-triggered animations with scroll reveal wrapper
  - Full responsive design with dark/light section alternation
  - Accessibility audit: ARIA labels, focus states, keyboard navigation, prefers-reduced-motion support
- ✅ SaaS payment scaffold + PLG onboarding plan (`260308-2053`) phases 1-4 completed:
  - Billing v1 scope locked (`trial_7d`, `pro`) with explicit out-of-scope boundaries
  - Simulated checkout API added (`/api/v1/billing/simulate/checkout`, `/api/v1/billing/me/subscription`)
  - Idempotent checkout persistence and billing audit events added
  - Entitlement enforcement upgraded (trial expiry block, board-group quota, agents-per-board quota)
  - Frontend upgrade modal + quota summary integrated into settings/sidebar and create flows
- ✅ Frontend performance hardening plan (`260308-1727`) phases 1-9 completed:
  - Route bundle metric collection + budget enforcement scripts
  - Server/client provider boundary split via `(app)` and `(public)` route groups
  - Query policy normalization for high-traffic routes with anti-pattern guard checks
  - SSE logic consolidated into reusable `useSSEStream` hook with exponential backoff
  - SSE buffer parsing abstracted to `parseSSEBuffer` utility function
  - Markdown heavy parser isolation via `LazyMarkdown` + `MarkdownLite`
  - Chat render hot-path optimization (state-layer ordering + `content-visibility`)
  - Perf verification complete with budgets passing:
    - shared root main: 400.8 KB / 430 KB
    - `/`: 951.4 KB / 1000 KB
    - `/dashboard`: 1072.2 KB / 1250 KB
    - `/boards`: 1111.3 KB / 1150 KB
    - `/activity`: 1075.6 KB / 1250 KB
- ✅ SaaS payment scaffold + PLG onboarding plan (`260308-2053`) phases 5-7 completed in code/CI:
  - Step-based onboarding progress API + migration (`/api/v1/onboarding/progress/me`)
  - New onboarding wizard/checklist with nav unlock gating by onboarding completion
  - Billing observability endpoints:
    - `GET /api/v1/metrics/saas-billing-health`
    - `GET /api/v1/billing/support/timeline`
    - `POST /api/v1/billing/events/upgrade-modal-open`
  - SaaS gates expanded with billing/onboarding/trial-expiry coverage

## Project Phases

### Phase 1: Foundation (Completed)

**Status**: ✅ Complete
**Timeline**: Q3 2024 - Q4 2024 (Completed)

#### Completed Features

- ✅ FastAPI backend with async SQLAlchemy/SQLModel
- ✅ Next.js 16 frontend with React 19
- ✅ PostgreSQL database with Alembic migrations
- ✅ Redis-backed RQ job queue
- ✅ Docker Compose orchestration
- ✅ Dual authentication (Clerk JWT + local bearer token)
- ✅ Basic CRUD operations for core entities
- ✅ OpenAPI documentation generation

#### Key Deliverables

- Working backend API with 24 route modules
- Functional frontend with 40+ pages
- Database schema with 28 models
- Docker deployment configuration
- Comprehensive installation script

---

### Phase 2: Core Operations (Completed)

**Status**: ✅ Complete
**Timeline**: Q4 2024 - Q1 2025 (Completed)

#### Completed Features

- ✅ Organization management with multi-tenancy
- ✅ Board groups and boards hierarchy
- ✅ Task management with custom fields
- ✅ Tag system for categorization
- ✅ Task dependencies and relationships
- ✅ Activity event logging and audit trail
- ✅ User management and organization invites
- ✅ Board-level and board-group-level memory
- ✅ Multi-session board chat (create, rename, archive-hide, auto-title, session-scoped paging)

#### Key Deliverables

- Complete work orchestration system
- Multi-tenant organization structure
- Flexible task metadata with custom fields
- Comprehensive activity logging
- User invitation and onboarding flow

---

### Phase 3: Agent Operations & React Performance Optimization (98% Complete)

**Status**: 🔄 In Progress (98% complete)
**Timeline**: Q1 2025 - Q2 2025 → Completed Q1 2026 + March 2026 enhancements (SLA, billing, email)

#### Completed Features

- ✅ Agent lifecycle management (create, start, stop, delete)
- ✅ Agent assignment to boards
- ✅ Agent configuration and metadata
- ✅ Skills marketplace integration
- ✅ Agent monitoring and status tracking
- ✅ Task review SLA automation (deadline checks, lead nudge, auto-reassign)
- ✅ OpenClaw gateway integration
- ✅ Gateway WebSocket communication
- ✅ Gateway health checks
- ✅ Board planning overlay with TaskGroup model, cursor pagination, grouped rendering, density modes
- ✅ Board chat multi-session with file upload (MinIO) + PDF OCR extraction
- ✅ Frontend performance optimization (route groups, SSE consolidation)
- ✅ Reusable SSE streaming patterns (`useSSEStream`, `parseSSEBuffer`)
- ✅ React Query policy normalization with bundle budget enforcement
- ✅ Markdown heavy dependency isolation (`LazyMarkdown`, `MarkdownLite`)
- ✅ Chat render-path optimization (ordered upsert merge, render sort removal, content-visibility)
- ✅ Performance hardening verification + rollout checklist for plan `260308-1727`
- ✅ Token ledger + per-agent quota surfaces with ledger aggregation
- ✅ SaaS hardening with billing enforcement (trial expiry, quota blocks)

#### In Progress

- 🔄 Advanced agent scheduling and orchestration
- 🔄 Agent performance metrics and analytics
- 🔄 Multi-agent coordination patterns
- 🔄 Agent failure recovery and retry logic

#### Completed Features (Recent)

- ✅ Payment Flow UX Rework (Plan 260316-1405):
  - Polar customer portal integration (`/api/v1/billing/portal-session`)
  - Billing email system (upgrade, trial warning, payment failure notifications)
  - Redesigned upgrade modal with feature comparison and Pro-only layout
  - Sidebar usage meter with quota visualization
  - Billing settings section with plan info, trial countdown, and quota displays
  - Checkout success page with confetti animation and plan polling
  - Settings page refactored with billing component extraction
- ✅ Agent templates (workspace templates) with CRUD API
- ✅ Template picker UI on agent creation
- ✅ System seed templates library

#### Planned Features

- ⏳ Agent resource limits and quotas
- ⏳ Agent execution history and logs
- ⏳ Agent cost tracking and budgeting
- ⏳ Custom template creation and sharing

---

### Phase 4: Governance and Approvals (In Progress)

**Status**: 🔄 In Progress (70% complete)
**Timeline**: Q2 2025 - Q3 2025

#### Completed Features

- ✅ Approval workflow creation
- ✅ Approval request submission
- ✅ Approval/rejection actions
- ✅ Approval history and audit trail
- ✅ Task-approval linking

#### In Progress

- 🔄 Multi-stage approval chains
- 🔄 Conditional approval routing
- 🔄 Approval delegation
- 🔄 Approval notifications

#### Planned Features

- ⏳ Approval policy templates
- ⏳ Time-based approval expiration
- ⏳ Approval analytics and reporting
- ⏳ Role-based approval routing

---

### Phase 5: Gateway Management & Docker Migration (85% Complete)

**Status**: 🔄 In Progress (85% complete)
**Timeline**: Q2 2025 - Q3 2025 → Docker migration completed March 2026

#### Completed Features

- ✅ Gateway registration and configuration
- ✅ WebSocket-based gateway communication
- ✅ Gateway health monitoring
- ✅ Agent provisioning via gateways
- ✅ Gateway metadata and status tracking
- ✅ Async gateway activation queue with retry-backed provisioning states (`activating`, `ready`, `degraded`)
- ✅ Managed gateway auto-provision for newly created organizations (free + paid tiers) with non-blocking activation
- ✅ OpenClaw Docker service with managed workspace volume (`MANAGED_GATEWAY_WORKSPACE_ROOT`)
- ✅ 3 custom model providers configuration in Docker-based gateway

#### In Progress

- 🔄 Gateway load balancing
- 🔄 Gateway failover and redundancy
- 🔄 Gateway metrics and performance monitoring

#### Planned Features

- ⏳ Multi-gateway agent distribution
- ⏳ Gateway resource utilization tracking
- ⏳ Gateway authentication and security
- ⏳ Gateway version management

---

### Phase 6: Observability and Metrics (Planned)

**Status**: ⏳ Planned
**Timeline**: Q3 2026 - Q4 2026

#### Planned Features

- ⏳ Enhanced metrics dashboard
- ⏳ Real-time system health monitoring
- ⏳ Performance analytics and insights
- ⏳ Custom metric definitions
- ⏳ Alerting and notification system
- ⏳ Log aggregation and search
- ⏳ Distributed tracing integration
- ⏳ SLA monitoring and reporting

#### Success Criteria

- Comprehensive metrics for all operations
- Real-time dashboard with key indicators
- Alerting for critical system events
- Performance bottleneck identification

---

### Phase 7: Advanced Features (Planned)

**Status**: ⏳ Planned
**Timeline**: Q4 2026 - Q1 2027

#### Planned Features

- ⏳ Workflow templates and board cloning
- ⏳ Advanced search with full-text indexing
- ⏳ Scheduled task execution (cron-like)
- ⏳ Bulk operations for tasks and boards
- ⏳ Export/import functionality
- ⏳ API rate limiting and quotas
- ⏳ Webhook retry and dead letter queue
- ⏳ Advanced filtering and saved views

#### Success Criteria

- Reusable workflow templates
- Fast full-text search across all entities
- Reliable scheduled task execution
- Efficient bulk operations

---

### Phase 8: Integration and Extensibility (Planned)

**Status**: ⏳ Planned
**Timeline**: Q2 2027 - Q3 2027

#### Planned Features

- ⏳ Slack/Discord integration
- ⏳ GitHub/GitLab integration
- ⏳ Jira/Linear synchronization
- ⏳ Prometheus metrics export
- ⏳ Grafana dashboard templates
- ⏳ Custom webhook handlers
- ⏳ Plugin system for extensions
- ⏳ SSO providers beyond Clerk

#### Success Criteria

- Seamless integration with popular tools
- Extensible plugin architecture
- Standard metrics export formats
- Multiple SSO provider support

---

### Phase 9: Production Hardening (Planned)

**Status**: ⏳ Planned
**Timeline**: Q3 2027 - Q4 2027

#### Planned Features

- ⏳ Database read replicas
- ⏳ Redis cluster support
- ⏳ Multi-region deployment support
- ⏳ Automated backup and restore
- ⏳ Disaster recovery procedures
- ⏳ Performance optimization
- ⏳ Security hardening and penetration testing
- ⏳ Compliance certifications (SOC 2, ISO 27001)

#### Success Criteria

- 99.9% uptime SLA
- Sub-second API response times
- Automated disaster recovery
- Security audit completion

---

### Phase 10: Scale and Polish (Planned)

**Status**: ⏳ Planned
**Timeline**: Q4 2027 - Q1 2028

#### Planned Features

- ⏳ Mobile-responsive UI improvements
- ⏳ Internationalization (i18n)
- ⏳ Accessibility enhancements (WCAG 2.1 AA)
- ⏳ Advanced analytics and reporting
- ⏳ User onboarding improvements
- ⏳ In-app help and documentation
- ⏳ Performance profiling tools
- ⏳ Cost optimization recommendations

#### Success Criteria

- Mobile-friendly interface
- Multi-language support
- WCAG 2.1 AA compliance
- Comprehensive user documentation

---

## Feature Roadmap by Category

### Work Orchestration

- ✅ Organizations, board groups, boards, tasks
- ✅ Custom fields for tasks
- ✅ Task dependencies
- ✅ Tag system
- 🔄 Workflow templates
- ⏳ Board cloning
- ⏳ Scheduled tasks
- ⏳ Bulk operations

### Agent Operations

- ✅ Agent lifecycle management
- ✅ Skills marketplace
- ✅ Gateway integration
- 🔄 Agent scheduling
- 🔄 Multi-agent coordination
- ⏳ Agent templates
- ⏳ Resource limits
- ⏳ Cost tracking

### Governance

- ✅ Basic approval workflows
- 🔄 Multi-stage approvals
- 🔄 Approval delegation
- ⏳ Approval policies
- ⏳ Time-based expiration
- ⏳ Approval analytics

### Observability

- ✅ Activity event logging
- ✅ Basic metrics endpoint
- 🔄 Gateway health monitoring
- ⏳ Enhanced metrics dashboard
- ⏳ Alerting system
- ⏳ Distributed tracing
- ⏳ Log aggregation

### Integration

- ✅ Webhook support
- ⏳ Slack/Discord
- ⏳ GitHub/GitLab
- ⏳ Jira/Linear
- ⏳ Prometheus/Grafana
- ⏳ Additional SSO providers

### Infrastructure

- ✅ Docker deployment
- ✅ Local development mode
- ✅ CI/CD pipeline
- ⏳ Database read replicas
- ⏳ Redis cluster
- ⏳ Multi-region support
- ⏳ Automated backups

---

## Milestones

### Milestone 1: MVP Release (Target: Q2 2026)

**Status**: 🔄 In Progress (Phase 3-4 at 98% and 70%)

**Goals**:

- Complete agent operations features (done)
- Stable approval workflows (70% done)
- Production-ready gateway management (85% done)
- Comprehensive documentation (ongoing)

**Progress**:

- Task review SLA automation ✅ (2026-03-21)
- Billing & Polar integration ✅ (2026-03-16)
- Payment flow UX redesign ✅ (2026-03-16)
- Workspace templates ✅ (2026-03-13)
- SaaS hardening & enforcement ✅ (2026-03-12)

---

### Milestone 2: Production Ready (Target: Q3 2026)

**Status**: ⏳ Planned

**Goals**:

- Enhanced observability and metrics (Phase 6)
- Security hardening and compliance (Phase 9)
- Performance optimization and scaling (Phase 9)
- Production deployment with HA/DR guide

**Dependencies**:

- Milestone 1 completion (Phase 3-5 convergence)
- Security audit
- Load testing at 10K+ concurrent boards

---

### Milestone 3: Enterprise Features (Target: Q4 2026)

**Status**: ⏳ Planned

**Goals**:

- Advanced integrations (Slack, GitHub, Jira)
- Workflow templates and board cloning (Phase 7)
- Enhanced analytics and reporting (Phase 6)
- Multi-region support (Phase 9)

**Dependencies**:

- Milestone 2 completion (Phase 5-6)
- Customer feedback loop
- Scalability and load testing validation

---

## Version History

### v0.1.0 (Current - In Development)

- Initial release with core features
- Organization and board management
- Task orchestration with custom fields
- Agent lifecycle management
- Gateway integration
- Basic approval workflows
- Activity logging

### Planned Releases

#### v0.2.0 (Target: Q2 2026)

- Enhanced agent scheduling and coordination
- Multi-stage approval chains
- Gateway load balancing and failover
- Improved observability dashboard

#### v0.3.0 (Target: Q3 2026)

- Workflow templates and board cloning
- Advanced full-text search
- Scheduled task execution
- Integration framework (Slack, GitHub, Jira)

#### v1.0.0 (Target: Q4 2026)

- Production-ready release with 99.9% SLA
- Full Phase 5-9 feature set
- Comprehensive documentation and API
- SOC 2 Type II compliance certification

---

## Success Metrics

### Current Metrics (as of v0.1.0-dev March 2026)

- Backend API routes: 31 modules (billing, board-chat, metrics endpoints, etc.)
- Frontend pages: 40+ routes with (app)/(public) route groups
- Database models: 41 entities (including chat sessions, review SLA, token ledger)
- Test coverage: Backend ~40%, Frontend ~30%
- Documentation pages: 25+ markdown files in docs/

### Target Metrics (v1.0.0)

- API response time: P95 < 200ms
- Test coverage: Backend > 80%, Frontend > 70%
- System uptime: 99.9%
- Documentation coverage: 100% of API endpoints
- User satisfaction: > 4.5/5

---

## Community and Contribution

### Current State

- Open source (MIT License)
- Active development on GitHub
- Issue tracking and pull requests
- Contributing guide available

### Future Plans

- Community forum or Discord server
- Regular release cadence (monthly)
- Public roadmap with voting
- Plugin marketplace
- Community-contributed integrations

---

## Known Limitations

### Current Limitations

- Single-region deployment only
- No multi-database support (PostgreSQL only)
- English-only UI
- Limited mobile responsiveness
- No real-time collaboration features

### Planned Improvements

- Multi-region support (Phase 9)
- Internationalization (Phase 10)
- Mobile-responsive UI (Phase 10)
- Real-time collaboration (Phase 7)

---

## Dependencies and Risks

### Technical Dependencies

- PostgreSQL 14+ availability
- Redis 6+ availability
- Docker/Docker Compose for deployment
- Node.js 22+ for frontend development
- Python 3.12+ for backend development

### Key Risks

- **Scalability**: Need to validate performance at scale
- **Security**: Ongoing security audits required
- **Gateway Stability**: WebSocket connection reliability
- **Breaking Changes**: API stability during active development

### Mitigation Strategies

- Regular load testing and performance profiling
- Security audits and penetration testing
- Gateway connection retry and failover logic
- Semantic versioning and deprecation notices

---

## Unresolved Questions

1. What is the target release date for v1.0.0?
2. Should we prioritize mobile app development?
3. What is the strategy for backward compatibility during v0.x releases?

# Project Changelog

## 2026-03-16

### Payment Flow UX Rework (Plan 260316-1405)

**Backend improvements:**
- New `GET /api/v1/billing/portal-session` endpoint for Polar customer portal access
- Polar customer ID stored in webhook metadata on subscription activation
- Billing email system with Resend provider:
  - Upgrade confirmation email on plan activation
  - Trial expiring warning email
  - Payment failed notification email
- Email queue worker registration in `backend/app/services/queue_worker.py`

**Frontend improvements:**
- Pricing page "Get Pro" CTA now routes to auth-gated `/checkout/pro` (Polar redirect)
- Upgrade modal redesigned with Pro-only layout and feature comparison
- Removed trial_7d option from upgrade card UI (Trial is entry tier, Pro is upgrade)
- New sidebar usage meter: shows highest-% quota with color-coded progress bar
- New billing settings section with:
  - Current plan badge and tier display
  - Trial countdown timer
  - Usage meters for each quota type
  - Direct link to Polar customer portal
- New checkout success page with confetti celebration animation
- Plan activation polling on checkout success for real-time updates
- Billing settings extracted into reusable `BillingSettingsSection` component
- Settings page simplified with billing component extraction

---

### Onboarding wizard flow refresh (question-first, no board/chat requirement)

- Refactored onboarding wizard UI to remove board creation/chat actions from step flow.
- Replaced action-driven steps with guided questions:
  - Workspace mode selection
  - First success outcome input
  - Collaboration timing selection
- Kept existing step keys for API compatibility while changing copy and captured details.
- Added custom use-case path with `Other (custom)` toggle and inline text input.
- Updated checklist links so all onboarding steps route to `/onboarding` instead of board/chat pages.
- Updated backend onboarding step titles to match the new question-first flow.
- Added frontend wizard tests for custom use case and non-board question submission.

---

## 2026-03-15

### OpenClaw Docker gateway migration + managed workspace volume

- Migrated gateway from standalone binary to Docker service at port 18789 in `compose.yml`
- Added managed workspace volume mount: `MANAGED_GATEWAY_WORKSPACE_ROOT` env var
- Configured 3 custom OpenClaw model providers in Docker gateway
- Added health check for openclaw service with container readiness validation
- Updated prod deploy guide with OpenClaw Docker service documentation
- Updated infrastructure setup scripts with openclaw-specific configuration
- Added volume management in docker-compose for persistent gateway workspace
- Integrated managed gateway auto-provisioning with async activation flow

### Brand and UI updates

- Added new BrandLoader component with animated SVG loading state
- Updated BrandMark component with new logo variations
- Added useSidebarCollapse hook for dashboard sidebar state management
- Added brand image assets to public/images/brand/
- Updated favicon with new VisgniteAI brand mark

---

## 2026-03-15 (Earlier)

### Organization invite email rollout (Resend + async queue)

- Added invite email provider configuration in
  `backend/app/core/config.py`:
  - `EMAIL_PROVIDER=none|resend`
  - `RESEND_API_KEY`
  - `RESEND_WEBHOOK_SECRET`
  - `EMAIL_FROM_INVITES`
  - `EMAIL_REPLY_TO`
  - `INVITE_ACCEPT_BASE_URL`
- Added Resend dependency in `backend/pyproject.toml`:
  - `resend>=2.23.0,<3`
- Added invite email service modules:
  - `backend/app/services/email/email_sender.py`
  - `backend/app/services/email/organization_invite_email.py`
  - `backend/app/services/email/resend_sender.py`
  - `backend/app/services/email/queue.py`
  - `backend/app/services/email/worker.py`
- Registered invite email queue handler in
  `backend/app/services/queue_worker.py` with existing retry/backoff policy.
- Added async invite-email enqueue on invite creation:
  - `POST /api/v1/organizations/me/invites` now commits invite then queues
    `organization_invite_email_send` best-effort.
- Added resend endpoint for pending invites:
  - `POST /api/v1/organizations/me/invites/{invite_id}/resend`
- Added frontend organization invites table resend action wired to the resend
  endpoint.
- Updated production compose wiring so backend + worker both read invite email
  env vars (`EMAIL_PROVIDER`, `RESEND_*`, sender, invite URL).
- Added admin audit action:
  - `organization.invite.resend` →
    `admin.organization.invite_resent`
- Added test coverage for config validation, sender mapping, queue payloads,
  worker behavior, queue worker registration, and invite create/resend API
  behavior.

---

## 2026-03-13

### Workspace Templates Feature

- Added `workspace_templates` database table with JSONB file_contents and org-scoping.
- New API endpoints for template CRUD:
  - `GET /api/v1/workspace-templates` — List org templates (including system seeds)
  - `POST /api/v1/workspace-templates` — Create custom org template
  - `GET /api/v1/workspace-templates/{id}` — Get template details
  - `PATCH /api/v1/workspace-templates/{id}` — Update template
  - `DELETE /api/v1/workspace-templates/{id}` — Delete template
- Backend service layer: `WorkspaceTemplateService` for list, get, create, update, delete operations.
- Template provisioning integration: `WorkspaceTemplateWriter` called during agent provisioning pipeline.
- Frontend template picker UI added to `/agents/new` page for template selection.
- 12 system seed templates auto-created on startup covering common OpenClaw agent personas.
- Template seeding service: `WorkspaceTemplateSeedService` creates system templates and manages migrations.
- New models: `WorkspaceTemplate`, schemas: `WorkspaceTemplateCreate`, `WorkspaceTemplateRead`, `WorkspaceTemplateUpdate`.

---

## 2026-03-12

### SaaS Hardening and Payment Enforcement
- Trial expiry enforcement returns 402 `blocked_for_payment` on write operations.
- Entitlements service enforces hard quotas:
  - Board groups per organization (tier-specific limit)
  - Agents per board (tier-specific limit)
- Billing simulated checkout API with idempotent persistence.
- Billing audit events for all signup/upgrade transactions.
- Frontend upgrade modal with quota summary surfaces.

### Board planning overlay compatibility plan (`260311-2312`) phases 5-7
- Added scalable board overlay UX behind rollout flags:
  - New global filter bar with saved views, status/priority filters, and URL
    query-state sync.
  - Grouped board rendering with per-group collapse and progress rollups.
  - Density modes and done-lane compression controls for high-volume boards.
- Added overlay view-model and query-state modules:
  - `frontend/src/lib/boards/board-query-state.ts`
  - `frontend/src/lib/boards/board-view-model.ts`
- Added new board overlay UI building blocks:
  - `frontend/src/components/organisms/task-board-filter-bar.tsx`
  - `frontend/src/components/organisms/task-group-column-section.tsx`
- Added lazy task-card detail hydration and batched large-list rendering in
  overlay mode to preserve interaction smoothness.
- Added rollout and observability controls:
  - Backend/Frontend feature flags for `board_planning_overlay_v1` and
    `board_query_v2` with canary board/org targeting.
  - New runtime telemetry endpoint: `GET /api/v1/metrics/board-overlay`.
  - Task query latency/filter usage instrumentation and agent loop regression
    marker tracking.
  - New operations runbook:
    `docs/operations/board-overlay-rollout-playbook.md`.
- Added regression coverage for overlay rollout and compatibility:
  - `backend/tests/test_board_overlay_compatibility.py`
  - `frontend/src/components/organisms/task-board-overlay.test.tsx`

## 2026-03-11

### Board planning overlay compatibility plan (`260311-2312`) phases 1-4
- Added immutable compatibility matrix for OpenClaw task-loop contracts at `docs/reference/board-planning-overlay-contract-matrix.md`.
- Added additive planning overlay data model:
  - New `task_groups` table/model
  - New optional task fields: `task_group_id`, `sort_index`, `archived_at`
  - New migration: `b9d4e7f1a2c3_add_task_group_overlay.py`
- Extended task query APIs with additive optional filters:
  - `q`, `tag_ids`, `priority`, `blocked`, `due_before`, `due_after`, `has_pending_approval`, `task_group_id`, `archived`
- Added scalable cursor query route: `GET /api/v1/boards/{board_id}/tasks/cursor`.
- Added optional compact board snapshot mode: `GET /api/v1/boards/{board_id}/snapshot?compact=true`.
- Hardened agent workflow guidance:
  - Updated `BOARD_HEARTBEAT.md.j2` with deterministic filtered selection recipes
  - Updated `BOARD_AGENTS.md.j2` with explicit task-group-as-planning-metadata guidance
  - Extended agent OpenAPI routing hints for filtered task discovery.
- Added regression tests:
  - `test_agent_task_contracts.py`
  - `test_task_query_scaling_contract.py`
  - `test_agent_heartbeat_task_selection_contract.py`
- Updated existing task permission tests for current notifier call signature compatibility.

## 2026-03-10

### Board chat file upload core (phases 1-7)
- Added file upload endpoint (`POST /api/v1/boards/{id}/chat-files/upload`) with multipart handling.
- Added file list, detail, and reports endpoints (`GET /api/v1/boards/{id}/chat-files*`) with pagination and filters.
- Added agent content endpoint (`GET /api/v1/agent/boards/{id}/chat-files/{file_id}/content`) for full text access with auth + task ownership guard.
- Extended `BoardMemoryRead` schema with lightweight attachment metadata for chat messages.
- Implemented frontend file picker with allowlist (`txt`, `md`, `csv`, `json`, `pdf`) and max-size validation (3 files/message).
- Implemented upload + send orchestration with optimistic state and error retry UX.
- Implemented message attachment chips rendering with extraction/report status badges.
- Added client-side file status polling (`GET /boards/{id}/chat-files?status=pending` every 10s) while files have non-terminal status.
- Backend models: `BoardChatFileAsset`, `BoardChatFileReport`, `BoardChatFileTask`, `BoardChatMessageFile` with proper indexing.
- Phase 8 (tests, observability, rollout) in progress.

## 2026-03-10 (earlier)

### Landing page responsive hardening for FHD, QHD, UHD, and mobile
- Expanded landing page layout shells and media surfaces for `1920`, `2560`, and `3840` width checkpoints instead of keeping every section capped at the same desktop width.
- Reworked the hero section to scale typography more cleanly on large screens while disabling heavy autoplay video on mobile, reduced-motion, and save-data scenarios.
- Restored the hero visual composition to the cleaner centered style after the first responsive pass pushed it too far from the original look.
- Reduced animation cost by replacing blur-based reveal motion with transform/opacity transitions and by slowing the trust marquee loop for smoother playback.
- Updated the trust marquee to glide brands from right to left again with a smoother, slower loop.
- Improved mobile interaction polish with scroll-locked navigation drawer, larger tap targets, and dynamic-section loading fallbacks.
- Added frontend tests for the new hero video policy and mobile navigation scroll-lock behavior.
- Switched the landing page back to native scrolling, reduced glass/blur paint cost, and tightened product preview rendering so workspace demo videos stay closer to their native aspect ratio and look sharper on desktop.

### Landing page feature section: Trusted + Scalable poster swap
- Replaced the landing page `One platform for every operational surface` placeholder cards with two CrewAI-inspired spotlight cards:
  - `Trusted`
  - `Scalable`
- Added the original CrewAI poster assets to the frontend public bundle for the landing page feature section.
- Updated the landing page feature section copy to frame trusted execution and scalable rollout in the current VisgniteAI narrative.
- Added frontend component test coverage for the new feature card rendering.

## 2026-03-09

### OpenClaw token ledger and per-agent quota surfaces (phase 4-6 first)
- Added token usage read-model for agents API responses with VN-day fields:
  - `token_used_today`
  - `token_limit_today`
  - `token_remaining_today`
  - `token_blocked`
  - `token_reset_at`
- Aligned entitlement quota token metrics with `agent_token_daily_usage` ledger aggregation.
- Kept compatibility fallback to `organization_plans.plan_metadata.token_usage` when ledger has no rows.
- Added frontend plan label mapper to display `Basic` for `trial_7d` while preserving backend tier values.
- Added Agents table `Tokens left` column and blocked badge with reset hint.
- Added backend tests for ledger-derived quota usage + agent token fields and frontend tests for token column and `Basic` label rendering.
- Added structured telemetry logs for usage-sync failures and quota block events.

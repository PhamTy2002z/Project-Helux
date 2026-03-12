# Project Changelog

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
- Updated the landing page feature section copy to frame trusted execution and scalable rollout in the current Helux narrative.
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

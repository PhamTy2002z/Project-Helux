# Project Changelog

## 2026-03-10

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

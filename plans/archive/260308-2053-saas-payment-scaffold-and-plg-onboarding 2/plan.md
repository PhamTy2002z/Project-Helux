---
title: "SaaS payment scaffold + product-led onboarding implementation plan"
description: "Triển khai SaaS-ready theo lộ trình: payment simulated modal unlock trước, tích hợp payment provider thật sau"
status: in_progress
priority: P0
effort: 4-7 weeks (simulated unlock + PLG), 2-4 weeks (real payment integration)
issue: null
branch: "chore/plan-saas-payment-scaffold-plg"
tags: [saas, payment, onboarding, backend, frontend, rollout]
created: 2026-03-08
---

# SaaS payment scaffold + PLG onboarding plan

## Overview
Mục tiêu: shipping nhanh SaaS paywall cơ bản, không overbuild payment.
Scope v1: modal chọn gói -> simulated unlock subscription, enforce quota cứng.

Pricing v1:
- Trial 7 ngày: hết hạn thì block runtime, chỉ cho vào billing/upgrade.
- Pro: mở quota cao hơn để user chạy production-lite.
- Enterprise: defer, chỉ giữ schema/contract forward-compatible.

## Phases
| # | Phase | Status | Effort | Link |
|---|---|---|---|---|
| 1 | Scope + architecture baseline | Completed | 1-2d | [phase-01](./phase-01-scope-and-architecture-baseline.md) |
| 2 | Backend simulated billing unlock | Completed | 4-6d | [phase-02](./phase-02-backend-payment-scaffold-simulated.md) |
| 3 | Entitlements + hard quota enforcement | Completed | 4-6d | [phase-03](./phase-03-entitlements-and-quota-automation-bridge.md) |
| 4 | Frontend billing modal + usage UX | Completed | 3-5d | [phase-04](./phase-04-frontend-billing-and-usage-experience.md) |
| 5 | PLG onboarding and first-value flow | Completed (local) | 5-7d | [phase-05](./phase-05-plg-onboarding-and-first-value-flow.md) |
| 6 | Observability + support operations | Completed (local) | 3-4d | [phase-06](./phase-06-observability-and-support-operations.md) |
| 7 | Test, migration, staged rollout | Completed (CI) | 4-5d | [phase-07](./phase-07-test-migration-and-staged-rollout.md) |
| 8 | Real payment provider integration (deferred) | Pending | 10-15d | [phase-08](./phase-08-real-payment-provider-integration.md) |

## Dependencies
- Phase 2 là nền tảng cho Phase 3-4.
- Phase 5 chạy song song được với cuối Phase 3-4.
- Phase 8 chỉ bắt đầu khi simulated flow ổn định và hạ tầng đã validate.

## Pricing policy v1 (locked)
- Trial (`trial_7d`):
  - `max_board_groups=1`, `max_boards=1`, `max_agents_per_board=3`, `max_agents_total=3`
  - token limit đề xuất: `org_daily_tokens=40000`, `agent_daily_tokens=15000`, `trial_total_tokens=280000`, `max_tokens_per_run=4000`
- Pro (`pro`):
  - `max_board_groups=1`, `max_boards=3`, `max_agents_per_board=5`, `max_agents_total=15`
  - token limit đề xuất: `org_daily_tokens=300000`, `agent_daily_tokens=35000`, `org_monthly_tokens=8000000`, `max_tokens_per_run=8000`
- Ghi chú:
  - Không tính gateway-main agents vào quota agent.
  - Chưa hỗ trợ add-on token ở v1.
  - Model policy do backend config riêng.

## Context links
- [Brainstorm report](../reports/brainstorm-260308-1830-saas-production-upgrade.md)
- [Project roadmap](../../docs/project-roadmap.md)
- [SaaS beta checklist](../../docs/release/saas-beta-go-live-checklist.md)
- [Current manual plan API](../../backend/app/api/organizations.py)
- [Current entitlements service](../../backend/app/services/entitlements.py)

## Unresolved questions
- None.

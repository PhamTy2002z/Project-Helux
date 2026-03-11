---
title: "SaaS Hardening Plan (No Payment)"
description: "Harden Mission Control from self-hosted-ready into public SaaS beta-ready without implementing billing flows"
status: completed
priority: P1
effort: 6w
issue: 2
branch: "feature/#2"
tags: [feature, backend, auth, multi-tenant, infra, security]
created: 2026-03-08
---

# SaaS Hardening Plan (No Payment)

## Overview

Goal: move current pre-release platform into SaaS beta readiness without payment integration.

Current state has strong product core (organizations, boards, ACL, agent ops) but weak production SaaS controls in authz consistency, DB-level tenant isolation, anti-abuse guardrails, and operations readiness.

## Scope

In scope:
- Security and authorization hardening.
- Tenant isolation hardening at data model + query policy + migration path.
- Rate limiting and entitlement/quota model (manual plans, no checkout).
- Reliability baseline: readiness checks, backup/restore drills, runbooks.
- Observability and audit completeness for multi-tenant operations.

Out of scope:
- Payment provider integration.
- Subscription checkout pages.
- Automated invoice/billing cycles.

## Constraints

- Keep existing product behavior stable where possible.
- Avoid big-bang schema rewrites.
- Preserve backward compatibility for existing API clients where feasible.
- No fake payment flows.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Authz + permission hardening | Completed (2026-03-08) | 4d | [phase-01](./phase-01-authz-and-permission-hardening.md) |
| 2 | Production auth mode hardening | Completed (2026-03-08) | 3d | [phase-02](./phase-02-auth-mode-production-hardening.md) |
| 3 | Tenant isolation foundation | Completed (2026-03-08) | 7d | [phase-03](./phase-03-tenant-data-isolation-foundation.md) |
| 4 | Rate limit + entitlements (no payment) | Completed (2026-03-08) | 5d | [phase-04](./phase-04-rate-limit-and-entitlements-no-payment.md) |
| 5 | Reliability + backup/restore readiness | Completed (2026-03-08) | 4d | [phase-05](./phase-05-readiness-reliability-backup-restore.md) |
| 6 | Observability + audit + supportability | Completed (2026-03-08) | 4d | [phase-06](./phase-06-observability-audit-and-supportability.md) |
| 7 | Rollout, validation, beta go-live gates | Completed (2026-03-08) | 3d | [phase-07](./phase-07-rollout-validation-and-beta-go-live.md) |

## Dependency Graph

Sequential critical path:
- Phase 1 -> Phase 2 -> Phase 3 -> Phase 7

Parallelizable lanes after Phase 3 starts:
- Lane A: Phase 4
- Lane B: Phase 5
- Lane C: Phase 6

Final merge:
- Phase 4 + Phase 5 + Phase 6 -> Phase 7

## File Ownership Matrix

- Auth/Authz files: Phase 1-2 only.
- Models/Migrations tenant keys: Phase 3 only.
- Rate-limit/entitlement modules + middleware config: Phase 4 only.
- Health/readiness/ops scripts: Phase 5 only.
- Logging/metrics/audit endpoints + docs: Phase 6 only.
- CI release gates + rollout docs: Phase 7 only.

## Acceptance Criteria (Program-Level)

- No known cross-tenant authz bypass in critical mutation endpoints.
- Production auth path does not accept local token fallback.
- Tenant isolation checks are consistent across API and service layers.
- Rate limiting enabled and quota surfaces visible per org.
- `/readyz` reflects real dependency state (DB + Redis + worker signal).
- Backup and restore drill documented and verified.
- Go-live checklist pass for public beta.

## Key Risks

- Migration risk while introducing stronger tenant keys.
- Hidden endpoint authz drift due large API surface.
- Operational complexity spikes if runbooks incomplete.

## Plan Notes

- `docs/development-rules.md` was referenced by skill docs but is not present in repo at planning time.
- This plan uses existing repo rules and architecture docs as baseline.

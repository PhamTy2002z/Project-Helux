---
title: "Resend organization invite email rollout"
description: "Implement async Resend delivery for organization invites with queue retry and idempotency"
status: completed
priority: P1
effort: 10h
branch: develop
tags: [feature, backend, api, email, organization]
created: 2026-03-15
updated: 2026-03-15
---

# Resend organization invite email rollout

## Overview

Ship email delivery for organization invites only. Keep current invite-token flow and
manual copy-link fallback. Delivery runs async via existing Redis queue worker.

## Phases

| # | Phase | Status | Effort | Link |
|---|---|---|---|---|
| 1 | Provider config and dependency baseline | completed | 1.5h | [phase-01](./phase-01-provider-config-and-dependency-baseline.md) |
| 2 | Invite email contract and resend sender | completed | 2h | [phase-02-invite-email-contract-and-resend-sender.md](./phase-02-invite-email-contract-and-resend-sender.md) |
| 3 | Queue task and worker pipeline integration | completed | 2h | [phase-03-queue-task-and-worker-pipeline-integration.md](./phase-03-queue-task-and-worker-pipeline-integration.md) |
| 4 | Organization invite API integration and resend endpoint | completed | 2h | [phase-04-organization-invite-api-integration-and-resend-endpoint.md](./phase-04-organization-invite-api-integration-and-resend-endpoint.md) |
| 5 | Tests, observability, and failure-mode hardening | completed | 1.5h | [phase-05-tests-observability-and-failure-mode-hardening.md](./phase-05-tests-observability-and-failure-mode-hardening.md) |
| 6 | Rollout, docs sync, and production checklist | completed | 1h | [phase-06-rollout-docs-sync-and-production-checklist.md](./phase-06-rollout-docs-sync-and-production-checklist.md) |

## Dependencies

- P2 depends on P1.
- P3 depends on P2.
- P4 depends on P3.
- P5 depends on P4.
- P6 depends on P5.

## Architecture snapshot

```text
POST /organizations/me/invites
  -> persist invite + commit
  -> enqueue email task (non-blocking)
  -> return invite response immediately

webhook-worker (existing)
  -> dequeue invite-email task
  -> send via Resend with Idempotency-Key
  -> retry with existing backoff+jitter on transient failures
```

## Key decisions

1. Scope now: organization invite email only. No password reset build.
2. Keep backward compatibility: invite token still returned and copy-link still works.
3. Use async queue pattern already used by webhook/board-chat workers.
4. Use deterministic idempotency key per invite send attempt.
5. Do not block invite creation on provider/network issues.

## Non-goals

- Replace Clerk/local auth flows.
- Build broad notification system.
- Add complex analytics pipeline in phase 1.

## Implementation progress

- Completed: provider config, email domain contracts, resend sender, queue/worker integration, create+resend API wiring, frontend resend control, automated tests, and docs sync.
- Completed rollout assets: staged rollout sequence, production toggle checklist, and rollback path.

## Unresolved questions

- None blocking for phase-1 start.

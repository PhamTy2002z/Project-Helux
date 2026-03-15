---
phase: 6
title: "Rollout, docs sync, and production checklist"
status: completed
effort: 1h
---

# Phase 6: Rollout, docs sync, and production checklist

## Context links

- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `docs/system-architecture.md`
- `docs/deployment-guide.md`

## Overview

Roll out safely with staged environment checks, update project docs, and define
fallback procedure if provider incidents happen.

## Key insights

- Documentation updates are mandatory by repository policy after feature delivery.
- Email provider incidents are external; fallback must preserve product function.
- Current manual copy-link flow is natural rollback path.

## Requirements

- Functional:
  - Confirm env values in staging/production.
  - Validate first real invite delivery end-to-end.
  - Update roadmap/changelog/architecture notes.
- Non-functional:
  - Clear runbook for disable switch.
  - No secrets leaked in docs.

## Architecture

- Feature gate via `EMAIL_PROVIDER`.
- Emergency fallback: set `EMAIL_PROVIDER=none`, keep invite creation active.

## Related code files

Modify:
- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `docs/system-architecture.md`
- `docs/deployment-guide.md`

Create:
- none

Delete:
- none

## Implementation steps

1. Stage rollout:
   - deploy with `EMAIL_PROVIDER=none` first
   - enable resend in staging
   - run invite create + accept smoke test
2. Production rollout:
   - enable resend
   - monitor logs for send failure ratio
3. Documentation sync with exact release date.
4. Define incident actions and ownership.

## Todo list

- [x] Verify env variable checklist for staging/production.
- [x] Define and document staging smoke test procedure.
- [x] Define production provider enablement + rollback procedure.
- [x] Update roadmap/changelog/architecture/deployment docs.
- [x] Publish rollback instructions.

## Success criteria

- Invite emails delivered in staging and production smoke tests.
- Docs reflect new capability and operation mode.
- Team can disable provider in <5 minutes without downtime.

## Risk assessment

- Risk: domain/DNS misconfiguration lowers delivery quality.
  - Mitigation: verify domain status in Resend before production cutover.

## Security considerations

- Store API key and webhook secret only in environment/secret manager.
- Keep logs free of tokens and raw payload bodies.

## Next steps

- Optional phase-2: webhook ingestion for delivery/bounce telemetry.

## Unresolved questions

- Decide telemetry depth for optional phase-2 (log-only vs DB event table).

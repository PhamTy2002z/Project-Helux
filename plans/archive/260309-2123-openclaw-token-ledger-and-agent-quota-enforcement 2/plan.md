---
title: "OpenClaw Token Ledger And Agent Quota Enforcement"
description: "Implement per-agent token accounting from OpenClaw usage, enforce hard daily limits, and expose remaining tokens in Agents UI with Basic naming consistency."
status: in_progress
priority: P1
effort: 28h
branch: develop
tags: [feature, backend, frontend, api, billing]
created: 2026-03-09
---

# OpenClaw Token Ledger And Agent Quota Enforcement

## Overview
Add real token accounting from OpenClaw to Mission Control, apply billing multiplier `0.5`, enforce per-agent daily hard caps, expose token remaining in Agents table, and standardize display name `Basic` for `trial_7d`.

## Phases
| # | Phase | Status | Effort | Link |
|---|---|---|---|---|
| 1 | OpenClaw Capability + Contract Lock | Pending | 4h | [phase-01](./phase-01-openclaw-capability-and-contract-lock.md) |
| 2 | Usage Ledger Data Model + Migration | Pending | 5h | [phase-02](./phase-02-usage-ledger-data-model-and-migration.md) |
| 3 | Usage Sync + Quota Enforcement Core | Pending | 7h | [phase-03](./phase-03-usage-sync-and-quota-enforcement-core.md) |
| 4 | API Read Models + Quota Surface Alignment | Completed | 4h | [phase-04](./phase-04-api-read-models-and-quota-surface-alignment.md) |
| 5 | Frontend Agents UI + Basic Label Normalization | Completed | 4h | [phase-05](./phase-05-frontend-agents-ui-and-basic-label-normalization.md) |
| 6 | Test Matrix + Rollout Guardrails | Completed | 4h | [phase-06](./phase-06-test-matrix-and-rollout-guardrails.md) |

## Dependencies
- OpenClaw gateway runtime must support `sessions.usage` handler.
- Existing plan policies in `backend/app/services/entitlements.py` remain source of token limits.
- Frontend API client regen required after schema updates.

## Key Decisions Locked
- Billing math: `billed_delta = ceil(openclaw_delta_tokens * 0.5)`.
- Daily boundary: VN timezone (`Asia/Ho_Chi_Minh` / `UTC+7`).
- Enforcement target: block board-scoped agent session dispatch when quota reached.
- Gateway main behavior: unchanged for now.

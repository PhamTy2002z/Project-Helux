---
title: "Board Chat File Upload Core (OpenClaw-aligned)"
description: "Implement deterministic file upload, agent processing reports, and board-shared knowledge for board chat."
status: pending
priority: P1
effort: 24h
branch: feature/cost-based-agent-quota
tags: [feature, backend, frontend, api, database, infra, critical]
created: 2026-03-10
---

# Board Chat File Upload Core (OpenClaw-aligned)

## Summary
Add core file pipeline for board chat: upload -> extract -> mention-delivery contract -> agent report callback -> shared board knowledge -> chat UI visibility.

## Locked Decisions
- V1 file types: `txt`, `md`, `csv`, `json`, `pdf`.
- Object storage: MinIO (S3 compatible) from day 1.
- Shared knowledge default: board-only. Board-group fanout deferred.
- SLA/retry (v1): dispatch ack timeout `30s`, report timeout `300s`, retry `2` with backoff `[30s, 120s]`.

## OpenClaw Constraints (Validated)
- `chat.send` attachment parse path is image-first (`parseMessageWithAttachments`); non-image docs not reliable for deterministic read.
- Document extraction lives in media-understanding flow (`applyMediaUnderstanding`) and appends `<file ...>` blocks.
- `agents.files.*` is workspace-file allowlist (`AGENTS.md`, `MEMORY.md`, etc.), not generic upload store.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Schema and storage foundation | pending | 3h | [phase-01](phase-01-schema-and-storage-foundation.md) |
| 2 | Upload and extraction pipeline | pending | 4h | [phase-02](phase-02-upload-and-extraction-pipeline.md) |
| 3 | Chat mention file-delivery contract | pending | 4h | [phase-03](phase-03-chat-mention-file-delivery-contract.md) |
| 4 | Agent reporting SLA and retry worker | pending | 3h | [phase-04](phase-04-agent-reporting-sla-and-retry-worker.md) |
| 5 | Shared knowledge publication (board scope) | pending | 2h | [phase-05](phase-05-shared-knowledge-publication-board-scope.md) |
| 6 | Query API and generated client | pending | 2h | [phase-06](phase-06-query-api-and-generated-client.md) |
| 7 | Frontend chat file UI | pending | 4h | [phase-07](phase-07-frontend-chat-file-ui.md) |
| 8 | Tests, observability, rollout | pending | 2h | [phase-08](phase-08-tests-observability-and-rollout.md) |

## Dependencies
- Phase 1 blocks all phases.
- Phase 2 blocks phase 3 and 6.
- Phase 3 blocks phase 4 and 7.
- Phase 4 and 5 block final UX verification in phase 8.
- Phase 6 should complete before phase 7 final wiring.

## Acceptance Gates
- Mentioned agent receives file manifest + extracted preview and can report against file id.
- Every processed file has persisted summary/detail report and status trace.
- Board-scoped shared knowledge auto-created and retrievable by other agents.
- UI shows uploaded files, extraction status, report status, and per-agent processing progress.

## Unresolved Questions
- None.

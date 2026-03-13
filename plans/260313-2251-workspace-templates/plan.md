---
title: "Workspace Templates"
description: "Pre-built agent configuration templates for 1-click deploy when creating agents on boards."
status: complete
priority: P1
effort: 20h
branch: develop
tags: [feature, backend, frontend, api, database]
created: 2026-03-13
completed: 2026-03-13
---

# Workspace Templates

## Summary
Add workspace template system: users pick a template when creating an agent on a board, Helux writes workspace files (AGENTS.md, SOUL.md, IDENTITY.md) to managed gateway filesystem. Agent loads template on next session start. No gateway restart needed.

## Locked Decisions
- Template = 3-4 markdown files stored as JSONB in Helux DB.
- No SKILL.md files (require gateway restart). Skills knowledge embedded in AGENTS.md.
- Provisioning via existing gateway file-write path (SSH/Docker exec).
- No template versioning in MVP. Template is starting point; user edits freely.
- Single agent per template. No team templates.
- Workspace files load at session start. No hot-reload, no restart.
- MVP: 12 seed templates (10 role-based + 2 blank).

## Key Constraints
- Files <= 20K chars each, total <= 150K chars across all workspace files.
- config.patch RPC rate limit: 3 req/60s.
- Workspace files NOT hot-reloaded; new session required.
- Agent model already has `identity_template` and `soul_template` fields.

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | DB schema + model | complete | 3h | [phase-01](phase-01-db-schema-and-model.md) |
| 2 | Backend CRUD API + seed data | complete | 4h | [phase-02](phase-02-backend-crud-api-and-seed-data.md) |
| 3 | Template provisioning service | complete | 4h | [phase-03](phase-03-template-provisioning-service.md) |
| 4 | Agent creation flow integration | complete | 3h | [phase-04](phase-04-agent-creation-flow-integration.md) |
| 5 | Frontend template picker UI | complete | 4h | [phase-05](phase-05-frontend-template-picker-ui.md) |
| 6 | Tests + rollout | complete | 2h | [phase-06](phase-06-tests-and-rollout.md) |

## Dependencies
- Phase 1 blocks all phases.
- Phase 2 blocks phases 3, 4, 5.
- Phase 3 blocks phase 4.
- Phase 4 blocks phase 6.
- Phase 5 can run in parallel with phase 3-4 (mock data).

## Acceptance Gates
- User creates agent from template; workspace files written to gateway filesystem.
- Agent loads template on first session. No restart needed.
- 12 seed templates available in template library.
- Template picker shown in agent creation flow.
- Existing agent creation flow works without template (backward compatible).
- Template content validated before write (char limits, no secrets).

## Unresolved Questions
- None blocking MVP. See research report for future considerations.

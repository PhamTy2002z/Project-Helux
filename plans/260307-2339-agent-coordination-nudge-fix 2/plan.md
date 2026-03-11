---
title: "Fix Agent Coordination Nudge Flow"
description: "Diagnose and fix agent provisioning so nudge via gateway RPC works"
status: pending
priority: P1
effort: 1h
branch: master
tags: [backend, agent-coordination, provisioning]
created: 2026-03-07
---

# Fix Agent Coordination Nudge Flow

## Overview

Lead agent (Ava) cannot nudge member agents (Visanya). Code and templates already match upstream 1:1. Root cause: agent provisioning/session state issue — not a template problem.

## Context

- Brainstorm: [brainstorm report](../reports/brainstorm-260307-2339-agent-coordination-nudge-fix.md)
- All backend code matches upstream: `coordination_service.py`, `gateway_dispatch.py`, `gateway_rpc.py`
- All templates match upstream: `BOARD_AGENTS.md.j2`, `BOARD_BOOTSTRAP.md.j2`, `BOARD_TOOLS.md.j2`
- Author's design: agents discover APIs via OpenAPI refresh → TSV (already in TOOLS.md)
- No template changes needed — follow author's approach exactly

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Diagnose agent provisioning | ✅ Completed | 30m | [phase-01](./phase-01-diagnose-provisioning.md) |
| 2 | Update lead template | ✅ Completed | 1.5h | [phase-02](./phase-02-update-lead-template.md) |
| 3 | Add OpenAPI refresh to bootstrap | ✅ Completed | 30m | [phase-03](./phase-03-bootstrap-openapi-refresh.md) |
| 4 | Verify end-to-end nudge flow | 🔄 Partial (code fixes verified, full E2E pending board onboarding) | 30m | [phase-04](./phase-04-verify-e2e.md) |

## Dependencies

- Phases 1-3 sequential, all completed
- Phase 4 code fixes verified; full E2E requires live board agents (will be created during board onboarding)

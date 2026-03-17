---
title: "Agent Bootstrap Status Indicator"
description: "Add readiness polling and UI indicator so users know when agent is still bootstrapping after onboarding"
status: Complete
priority: P2
effort: 6h
branch: master
tags: [feature, backend, frontend, ux]
created: 2026-03-07
---

# Agent Bootstrap Status Indicator

## Overview

After board onboarding + confirm, MC marks agent "online" immediately after gateway RPC succeeds. But OpenClaw gateway still bootstrapping internally — user sends message, no response, confusion. Messages queued (not lost), but no visibility into wait time.

**Solution:** Don't mark agent "online" prematurely. Use gateway `channels.status` RPC to check real bootstrap state. Frontend polls readiness, shows "Setting up..." indicator, blocks chat until ready.

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Backend readiness endpoint | Complete | 2h | [phase-01](./phase-01-backend-readiness-endpoint.md) |
| 2 | Lifecycle orchestrator fix | Complete | 1.5h | [phase-02](./phase-02-lifecycle-orchestrator-fix.md) |
| 3 | Frontend status indicator + chat blocking | Complete | 2h | [phase-03](./phase-03-frontend-status-indicator.md) |
| 4 | Testing | Complete | 0.5h | [phase-04](./phase-04-testing.md) |

## Dependencies

- Gateway `channels.status` RPC must return agent bootstrap state (needs verification)
- Agent SSE stream already provides status updates to frontend
- `BoardChatComposer` already has `disabled` prop
- `StatusDot` already handles `provisioning` status (amber dot)

## Key Architecture Decision

**Don't change `mark_provision_complete` default behavior.** Instead:
1. Keep lifecycle orchestrator marking `provisioning` (not `online`) after gateway RPC
2. Let heartbeat OR new readiness check transition to `online`
3. Frontend already streams agent status changes — just need to react to `provisioning` state

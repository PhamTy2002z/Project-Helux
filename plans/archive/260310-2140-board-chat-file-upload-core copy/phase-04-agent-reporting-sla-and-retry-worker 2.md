# Phase 4: Agent Reporting SLA and Retry Worker

## Context Links
- [Agent API](../../backend/app/api/agent.py)
- [Queue worker](../../backend/app/services/queue_worker.py)
- [Generic queue helper](../../backend/app/services/queue.py)
- [Gateway dispatch service](../../backend/app/services/openclaw/gateway_dispatch.py)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 3h

Implement agent report callback contract, task status progression, and timeout/retry policy.

## Key Insights
- Agent-scoped routes already proxy board-memory actions.
- Worker supports scheduled retries and typed handlers.
- Requirement #2 needs guaranteed report location and status trace.

## Requirements
- Functional:
  - Agent endpoint to submit summary/detail report for file task.
  - Persist report rows and mark file task as reported.
  - Enforce SLA policy: dispatch ack 30s, report timeout 300s, retries 2.
  - Retry by re-dispatching compact reminder payload.
- Non-functional:
  - Idempotent report writes for duplicate callbacks.
  - Clear terminal statuses: `reported|timeout|failed`.

## Architecture
- API endpoint:
  - `POST /api/v1/agent/boards/{board_id}/chat-files/{file_id}/reports`
- Queue task type:
  - `board_chat_file_report_deadline`
- Policy constants (configurable):
  - `board_chat_file_dispatch_ack_timeout_seconds=30`
  - `board_chat_file_report_timeout_seconds=300`
  - `board_chat_file_report_max_retries=2`
  - `board_chat_file_report_retry_backoff_seconds=30,120`

## Related Code Files
### Files to modify:
- `backend/app/api/agent.py` - add report callback route.
- `backend/app/services/queue_worker.py` - register report deadline handler.
- `backend/app/core/config.py` - add SLA/retry settings.

### Files to create:
- `backend/app/schemas/board_chat_file_reports.py`
- `backend/app/services/board_chat_files/reporting.py`
- `backend/app/services/board_chat_files/report_deadline_queue.py`
- `backend/app/services/board_chat_files/report_deadline_worker.py`

### Files to delete:
- None.

## Implementation Steps
1. Add report request schema with required `summary` and optional structured details.
2. Implement agent route with board-scope guard and task ownership validation.
3. Upsert report row keyed by `(file_asset_id, agent_id)`.
4. Update task status and timestamps (`reported_at`, `last_error`, `retry_count`).
5. Enqueue deadline-check task when delivery task created.
6. Deadline handler logic:
   - if reported: no-op
   - if retries remaining: re-dispatch reminder, schedule next check
   - else: mark timeout and stop
7. Emit structured logs for SLA events.

## Todo List
- [ ] Agent callback endpoint implemented and documented in OpenAPI.
- [ ] Idempotent report persistence implemented.
- [ ] Deadline queue and worker implemented.
- [ ] Retry policy implemented with configured backoff.
- [ ] Timeout terminal state implemented.

## Success Criteria
- Agent report creates durable row and marks task reported.
- Missed reports trigger retry up to 2 attempts, then timeout.
- SLA timestamps visible in DB and API responses.

## Risk Assessment
- Risk: duplicate reports from agent restarts.
  - Mitigation: idempotent upsert with latest timestamp.
- Risk: retry storm on gateway outage.
  - Mitigation: capped retries + exponential backoff + jitter.

## Security Considerations
- Only authenticated agent token can submit for own agent identity.
- Reject report writes for non-target agent/task combinations.
- Limit detail payload size to prevent abuse.

## Next Steps
- Phase 5 publishes board-shared knowledge from successful reports.

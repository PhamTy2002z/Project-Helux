# Phase 4: Agent Reporting SLA and Retry Worker

## Context Links
- [Board memory API](../../backend/app/api/board_memory.py)
- [Agent API](../../backend/app/api/agent.py)
- [Queue worker](../../backend/app/services/queue_worker.py)
- [Generic queue helper](../../backend/app/services/queue.py)
- [Gateway dispatch service](../../backend/app/services/openclaw/gateway_dispatch.py)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 3h

Parse agent file reports from board chat replies, persist report state, enforce SLA with deadline worker.

## Key Insights
- Agent interacts via WebSocket gateway; direct HTTP callback unreliable.
- Agent already replies to board via `POST /agent/boards/{id}/memory` (existing flow).
- Parse structured `[FILE_REPORT:file_id]` tag from agent chat reply content — no new agent-side protocol needed.
- Worker supports scheduled retries and typed handlers.

## Requirements
- Functional:
  - Detect `[FILE_REPORT:{file_id}]` tag in incoming agent chat messages.
  - Extract summary text following the tag.
  - Persist report rows and mark file task as reported.
  - Enforce SLA policy: dispatch ack 30s, report timeout 300s, retries 2.
  - Retry by re-dispatching compact reminder payload via gateway.
- Non-functional:
  - Idempotent report writes for duplicate/updated replies.
  - Clear terminal statuses: `reported|timeout|failed`.
  - Zero impact on non-file chat messages (no tag = skip parsing).

## Architecture

### Report Detection (in `create_board_memory` flow)
- After persisting agent chat message, check content for `[FILE_REPORT:{uuid}]` pattern.
- If found: extract file_id + summary text, delegate to report service.
- If not found: no-op, existing flow unchanged.

### Report Pattern
```
[FILE_REPORT:{file_asset_id}]
Summary text here. Can be multi-line.
Optionally structured with markdown.
```

Parser regex: `\[FILE_REPORT:([0-9a-f-]{36})\]\s*(.+)` (dotall mode for multi-line summary).

### Queue task type
- `board_chat_file_report_deadline`

### Policy constants (configurable)
- `board_chat_file_dispatch_ack_timeout_seconds=30`
- `board_chat_file_report_timeout_seconds=300`
- `board_chat_file_report_max_retries=2`
- `board_chat_file_report_retry_backoff_seconds=30,120`

## Related Code Files
### Files to modify:
- `backend/app/api/board_memory.py` - add report detection hook after agent message persist.
- `backend/app/services/queue_worker.py` - register report deadline handler.
- `backend/app/core/config.py` - add SLA/retry settings.

### Files to create:
- `backend/app/schemas/board_chat_file_reports.py`
- `backend/app/services/board_chat_files/report_parser.py`
- `backend/app/services/board_chat_files/reporting.py`
- `backend/app/services/board_chat_files/report_deadline_queue.py`
- `backend/app/services/board_chat_files/report_deadline_worker.py`

### Files to delete:
- None.

## Implementation Steps
1. Implement `report_parser.py`:
   - `parse_file_reports(content: str) -> list[ParsedFileReport]`
   - Extract all `[FILE_REPORT:{id}]` blocks from message content.
   - Return list of `(file_asset_id, summary_text)` tuples.
   - Handle edge cases: malformed UUIDs, empty summaries, multiple reports in one message.
2. Implement `reporting.py`:
   - `process_agent_file_report(session, agent, file_asset_id, summary) -> bool`
   - Validate: file_asset_id exists, agent has pending task for this file.
   - Upsert report row keyed by `(file_asset_id, agent_id)`.
   - Update task status to `reported`, set `reported_at` timestamp.
   - Return True if report accepted, False if rejected (wrong agent, unknown file, etc.).
3. Hook into `create_board_memory`:
   - After agent chat message is persisted (actor.type == "agent" and is_chat):
   - Call `parse_file_reports(memory.content)`.
   - For each parsed report: call `process_agent_file_report(...)`.
   - Log accepted/rejected reports. Do NOT fail the message create on report errors.
4. Implement deadline queue:
   - Enqueue `board_chat_file_report_deadline` task when file delivery task created (Phase 3).
   - Deadline handler logic:
     - If reported: no-op.
     - If retries remaining: re-dispatch reminder via gateway, schedule next check.
     - Else: mark timeout and stop.
5. Reminder message format (compact):
   ```
   REMINDER: File report pending
   File: {filename} (id: {file_id})
   Please reply with: [FILE_REPORT:{file_id}] your analysis summary
   ```
6. Emit structured logs for SLA events (dispatch, ack, report, timeout).

## Todo List
- [ ] Report parser implemented and unit tested.
- [ ] Report service with idempotent upsert implemented.
- [ ] Hook into board memory create for agent messages.
- [ ] Deadline queue and worker implemented.
- [ ] Retry policy with configured backoff implemented.
- [ ] Timeout terminal state implemented.
- [ ] Non-file messages pass through unaffected.

## Success Criteria
- Agent reply containing `[FILE_REPORT:uuid]` creates durable report row and marks task reported.
- Agent reply WITHOUT the tag has zero side effects on file processing.
- Missed reports trigger reminder up to 2 attempts, then timeout.
- SLA timestamps visible in DB and API responses.
- Multiple `[FILE_REPORT]` tags in single message each processed independently.

## Risk Assessment
- Risk: agent replies in wrong format (no tag, wrong UUID format).
  - Mitigation: parser is lenient; deadline worker sends reminder with exact format example.
- Risk: duplicate reports from agent retries.
  - Mitigation: idempotent upsert with latest timestamp wins.
- Risk: retry storm on gateway outage.
  - Mitigation: capped retries + exponential backoff + jitter.
- Risk: report parsing slows down normal chat message creation.
  - Mitigation: regex is O(n) on content length; skip entirely if no `[FILE_REPORT` substring found (fast path).

## Security Considerations
- Only agent actor can trigger report parsing (user messages skip detection).
- Validate file_asset_id belongs to same board as the message.
- Reject report if agent is not a target for that file task.
- Limit summary text size to prevent abuse (reuse `board_chat_file_preview_max_chars` * 4 as cap).

## Next Steps
- Phase 5 publishes board-shared knowledge from successful reports.

# Phase 8: Tests, Observability, and Rollout

## Context Links
- [Board memory tests](../../backend/tests/test_board_memory_chat_sessions.py)
- [Mentions tests](../../backend/tests/test_mentions.py)
- [Queue tests](../../backend/tests/test_queue.py)
- [Board chat session list test](../../frontend/src/components/boards/BoardChatSessionList.test.tsx)

## Overview
- **Priority**: P1
- **Status**: pending
- **Effort**: 2h

Add comprehensive tests, operational telemetry, and safe rollout sequence.

## Key Insights
- Existing tests already cover mention and chat-session behavior.
- New file flow spans API, worker, queue retries, and frontend state.
- Core feature requires strong regression coverage before merge.

## Requirements
- Functional:
  - Backend unit/integration coverage for upload, link, dispatch, report, shared memory.
  - Frontend tests for composer upload + attachment rendering.
  - Metrics/logging for SLA and failure visibility.
- Non-functional:
  - `make check` remains green.
  - Rollout supports staged enablement via feature flags.

## Architecture
- Test matrix:
  - API tests for upload + authorization + validation errors.
  - Service tests for extraction, delivery contract, retry worker.
  - Agent callback tests for idempotent report upsert.
  - UI tests for file picker and drawer states.
- Telemetry:
  - counters: uploads, extract_failures, report_timeouts, retry_attempts.
  - structured logs keyed by `file_asset_id`, `board_id`, `agent_id`.

## Related Code Files
### Files to modify:
- `backend/tests/test_board_memory_chat_sessions.py`
- `backend/tests/test_queue_worker_lifecycle_handler.py` (or new worker-specific tests)
- `frontend/src/components/boards/BoardChatSessionList.test.tsx` (if shared fixtures touched)

### Files to create:
- `backend/tests/test_board_chat_file_upload_api.py`
- `backend/tests/test_board_chat_file_delivery.py`
- `backend/tests/test_board_chat_file_reporting_worker.py`
- `frontend/src/components/boards/BoardChatThread.files.test.tsx`
- `frontend/src/components/BoardChatComposer.files.test.tsx`

### Files to delete:
- None.

## Implementation Steps
1. Add backend tests for positive + negative upload flows.
2. Add tests for mention-target delivery and task creation.
3. Add retry/timeout worker tests using queued task fixtures.
4. Add shared-knowledge publication assertions.
5. Add frontend tests for upload chips, send-with-files, and report drawer rendering.
6. Add logs/metrics at upload, dispatch, report, timeout boundaries.
7. Execute validation commands:
   - `make backend-test`
   - `make frontend-test`
   - `make check`

## Todo List
- [ ] Backend API/service/worker tests added.
- [ ] Frontend chat file UI tests added.
- [ ] Observability signals added and documented.
- [ ] Full check pipeline passes.

## Success Criteria
- End-to-end scenario passes: upload -> mention -> report -> shared memory -> UI reflects complete state.
- Failure scenarios covered: unsupported mime, oversize, extract fail, report timeout.
- No regression in existing board chat behavior.

## Risk Assessment
- Risk: flaky async worker tests.
  - Mitigation: deterministic queue fixtures + fixed clock where possible.
- Risk: release without ops visibility.
  - Mitigation: mandatory counters/log fields before enablement.

## Security Considerations
- Add tests for cross-board file access denial.
- Validate auth boundaries on agent report callback endpoints.

## Next Steps
- Enable feature flag for one internal board, observe metrics 48h, then broad enable.

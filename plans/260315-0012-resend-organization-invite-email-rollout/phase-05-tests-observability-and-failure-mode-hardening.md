---
phase: 5
title: "Tests, observability, and failure-mode hardening"
status: completed
effort: 1.5h
---

# Phase 5: Tests, observability, and failure-mode hardening

## Context links

- `backend/tests/test_organizations_service.py`
- `backend/tests/api/*` (organization invite API tests)
- `backend/tests/test_queue_worker_*`
- `backend/app/services/queue_worker.py`

## Overview

Add deterministic test coverage for config, sender, queue, and API integration.
Add operational logging signals for support and incident triage.

## Key insights

- Existing test patterns already validate queue handler registration.
- Structured logs are primary observability mechanism in this codebase.
- Must cover non-happy paths: provider timeout, invalid config, enqueue fail.

## Requirements

- Functional:
  - Verify create invite enqueues email task.
  - Verify resend endpoint rules.
  - Verify worker retries on transient send failures.
- Non-functional:
  - Keep tests isolated with monkeypatch/fake sender.
  - Keep log fields consistent and searchable.

## Architecture

- Unit tests for sender + queue encoding.
- API tests for route behavior.
- Worker tests for handler registration and retry semantics.

## Related code files

Modify:
- `backend/tests/api/...` invite-related tests
- `backend/tests/test_queue_worker_*.py`
- `backend/tests/services/...` new email service tests

Create:
- `backend/tests/services/test_invite_email_sender.py`
- `backend/tests/services/test_invite_email_queue.py`

Delete:
- none

## Implementation steps

1. Add config validation tests for `EMAIL_PROVIDER=resend` requirements.
2. Add sender tests:
   - idempotency key mapping
   - payload mapping (`from`, `to`, `reply_to`)
3. Add queue tests: encode/decode/requeue behavior.
4. Add API tests for create + resend route outcomes.
5. Add log assertions for core failure paths where practical.

## Todo list

- [x] Add settings validation tests.
- [x] Add resend sender unit tests.
- [x] Add queue/worker tests.
- [x] Add API integration tests.
- [x] Run backend lint + tests + coverage target commands.

## Success criteria

- New email invite paths are covered by automated tests.
- No regression in existing invite flow tests.
- Worker retry behavior verified with capped attempts.

## Risk assessment

- Risk: flaky tests around async retry.
  - Mitigation: isolate retry calculations and patch sleep/backoff.

## Security considerations

- Ensure tests never use real API keys.
- Redact sensitive values in test fixtures and assertion snapshots.

## Next steps

- Phase 6 documents rollout and production readiness gates.

## Unresolved questions

- None.

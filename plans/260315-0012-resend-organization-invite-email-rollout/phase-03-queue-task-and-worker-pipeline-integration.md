---
phase: 3
title: "Queue task and worker pipeline integration"
status: completed
effort: 2h
---

# Phase 3: Queue task and worker pipeline integration

## Context links

- `backend/app/services/queue.py`
- `backend/app/services/queue_worker.py`
- `backend/app/services/webhooks/queue.py`
- `backend/app/services/webhooks/dispatch.py`

## Overview

Integrate invite email sending into existing Redis queue + worker loop. Reuse
retry/backoff/jitter semantics already used by current task handlers.

## Key insights

- Queue infrastructure already supports delayed requeue + capped retries.
- Worker handler registry in `queue_worker.py` is extension point.
- Async delivery avoids blocking invite API latency.

## Requirements

- Functional:
  - Enqueue invite send task payload.
  - Worker dequeues and sends through phase-2 sender.
  - Retry transient failures with existing policy.
- Non-functional:
  - Task payload must be minimal and serializable.
  - Task handling idempotent and safe across retries.

## Architecture

```text
enqueue_invite_email(invite_id, email, token, org_name)
  -> QueuedTask(task_type="organization_invite_email_send", ...)

queue_worker._TASK_HANDLERS["organization_invite_email_send"]
  -> process_invite_email_task
  -> requeue_invite_email_task
```

## Related code files

Create:
- `backend/app/services/email/queue.py`
- `backend/app/services/email/worker.py`

Modify:
- `backend/app/services/queue_worker.py`

Delete:
- none

## Implementation steps

1. Add queue payload dataclass + encode/decode helpers.
2. Add enqueue helper API for invite flows.
3. Implement worker processor:
   - load needed invite context safely
   - call sender
   - handle accepted/terminal errors
4. Register handler in `_TASK_HANDLERS` with existing retry calculators.
5. Emit structured queue logs with task_type and attempt.

## Todo list

- [x] Create invite-email queue module.
- [x] Create invite-email worker module.
- [x] Register handler in global worker map.
- [x] Wire retry/requeue behavior.
- [x] Add queue/worker tests.

## Success criteria

- Invite email tasks are consumed by existing webhook-worker container.
- Transient provider/network failures are retried then dropped at retry cap.
- Duplicate retries do not create duplicate external sends (idempotency key).

## Risk assessment

- Risk: worker crash loops on bad payload.
  - Mitigation: payload validation + guard logging + drop invalid task.

## Security considerations

- Payload stores minimal sensitive data.
- No token value written to logs.

## Next steps

- Phase 4 triggers enqueue from organization invite APIs.

## Unresolved questions

- None.

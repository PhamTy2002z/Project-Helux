## Phase 2: Queue + Worker for Welcome Email

**Priority:** P1 | **Status:** Complete | **Effort:** 1h

### Overview

Create queue payload helpers and worker handler for welcome email tasks. Mirror existing invite email queue/worker pattern.

### Related Code Files

**Create:**
- `backend/app/services/email/welcome_email_queue.py` — queue payload + enqueue helper
- `backend/app/services/email/welcome_email_worker.py` — worker handler

**Modify:**
- `backend/app/services/queue_worker.py` — register new task type handler

### Implementation Steps

1. Create `welcome_email_queue.py`:
   - `TASK_TYPE = "welcome_email_send"`
   - `QueuedWelcomeEmail(user_email, user_id, first_name, send_key, trigger, attempts)` frozen dataclass
   - `_task_from_payload(payload) -> QueuedTask` — serialize to queue format
   - `decode_welcome_email_task(task) -> QueuedWelcomeEmail` — deserialize
   - `enqueue_welcome_email_send(user_email, user_id, first_name, trigger) -> bool`
   - `requeue_welcome_email_task(task, delay_seconds) -> bool`

2. Create `welcome_email_worker.py`:
   - `get_welcome_email_sender() -> WelcomeEmailSender | None` — factory (same pattern as invite)
   - `process_welcome_email_task(task: QueuedTask) -> None`:
     - Decode payload
     - Check provider enabled (skip if `EMAIL_PROVIDER=none`)
     - Build welcome email content via `build_welcome_email()`
     - Send via `ResendWelcomeEmailSender`
     - Handle retryable vs non-retryable errors
     - Structured logging throughout

3. Register in `queue_worker.py`:
   - Import `TASK_TYPE` from `welcome_email_queue`
   - Import `process_welcome_email_task` from `welcome_email_worker`
   - Import `requeue_welcome_email_task` from `welcome_email_queue`
   - Add entry to `_TASK_HANDLERS` dict (same retry/backoff pattern)

### Todo

- [x] Create `welcome_email_queue.py` with payload + enqueue
- [x] Create `welcome_email_worker.py` with handler
- [x] Register task type in `queue_worker.py`

### Success Criteria

- `enqueue_welcome_email_send()` pushes task to Redis queue
- Worker processes task and sends email via Resend
- Failed sends requeue with exponential backoff (max 3 retries)
- Structured logging for all states (skipped, started, succeeded, failed)

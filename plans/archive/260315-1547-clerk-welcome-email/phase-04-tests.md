## Phase 4: Tests

**Priority:** P2 | **Status:** Complete | **Effort:** 0.5h

### Overview

Write unit tests for welcome email template builder, queue helpers, worker handler, and webhook endpoint.

### Related Code Files

**Create:**
- `backend/tests/services/email/test_welcome_email.py`
- `backend/tests/services/email/test_welcome_email_queue.py`
- `backend/tests/services/email/test_welcome_email_worker.py`
- `backend/tests/api/test_clerk_webhooks.py`

### Implementation Steps

1. `test_welcome_email.py`:
   - Test `build_welcome_email()` returns valid content with correct subject/HTML/text
   - Test first name fallback when empty/None
   - Test dashboard URL embedded in CTA

2. `test_welcome_email_queue.py`:
   - Test `enqueue_welcome_email_send()` creates valid queue task
   - Test `decode_welcome_email_task()` round-trip serialization
   - Test decode handles missing/invalid fields gracefully

3. `test_welcome_email_worker.py`:
   - Test provider disabled → skip
   - Test successful send → logs success
   - Test retryable error → re-raises for retry
   - Test non-retryable error → logs and returns

4. `test_clerk_webhooks.py`:
   - Test invalid signature → 400
   - Test `user.created` → enqueue called
   - Test other event types → 200, no enqueue
   - Test `AUTH_MODE=local` → early return or 404

### Todo

- [x] Template builder tests
- [x] Queue encode/decode tests
- [x] Worker handler tests
- [x] Webhook endpoint tests

### Success Criteria

- All tests pass
- Coverage for happy path + error cases
- No mocking of database (welcome email has no DB dependency)

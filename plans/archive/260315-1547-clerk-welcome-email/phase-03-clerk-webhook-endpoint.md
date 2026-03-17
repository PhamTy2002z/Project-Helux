## Phase 3: Clerk Webhook Endpoint

**Priority:** P1 | **Status:** Complete | **Effort:** 1.5h

### Overview

Create a Clerk webhook receiver endpoint that verifies Svix signatures and dispatches `user.created` events to enqueue welcome emails.

### Key Insights

- Clerk uses **Svix** for webhook delivery — need `svix` Python package for signature verification
- Webhook payload contains `data.email_addresses`, `data.first_name`, `data.id`
- Must verify signature BEFORE processing to prevent spoofed events
- Endpoint must be unauthenticated (Clerk calls it, not users)
- Only active when `AUTH_MODE=clerk`

### Requirements

**Functional:**
- `POST /api/v1/webhooks/clerk` — receives Clerk webhook events
- Verify Svix signature using `CLERK_WEBHOOK_SECRET`
- Handle `user.created` event → enqueue welcome email
- Ignore other event types gracefully (return 200)
- Return 400 on invalid signature

**Non-functional:**
- Idempotent — same event delivered twice should not send duplicate emails
- Fast response — enqueue is non-blocking, return 200 immediately
- No auth required on this endpoint (webhook sender is Clerk, not users)

### Related Code Files

**Create:**
- `backend/app/api/clerk_webhooks.py` — webhook receiver endpoint

**Modify:**
- `backend/app/main.py` — register new router
- `backend/app/core/config.py` — add `CLERK_WEBHOOK_SECRET` setting
- `backend/pyproject.toml` — add `svix` dependency
- `backend/.env.example` — document new env var

### Implementation Steps

1. Add `svix` to `pyproject.toml` dependencies

2. Add config in `config.py`:
   - `clerk_webhook_secret: str = ""` — empty = webhooks disabled
   - Validation: warn if `AUTH_MODE=clerk` and `clerk_webhook_secret` empty

3. Create `clerk_webhooks.py`:
   ```python
   router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])

   @router.post("/clerk")
   async def handle_clerk_webhook(request: Request) -> dict:
       # 1. Guard: skip if AUTH_MODE != clerk or no webhook secret
       # 2. Read raw body + headers (svix-id, svix-timestamp, svix-signature)
       # 3. Verify with svix.Webhook(secret).verify(body, headers)
       # 4. Parse event type from payload["type"]
       # 5. If "user.created": extract email, first_name, user_id
       # 6. Enqueue welcome_email_send task
       # 7. Return {"status": "ok"}
   ```

4. Register router in `main.py`:
   - Import `clerk_webhooks` router
   - Include with condition: only if `AUTH_MODE=clerk`

5. Update `.env.example` with `CLERK_WEBHOOK_SECRET` documentation

### Todo

- [x] Add `svix` dependency
- [x] Add `clerk_webhook_secret` to config
- [x] Create `clerk_webhooks.py` endpoint
- [x] Register router in `main.py`
- [x] Update `.env.example`

### Success Criteria

- Invalid/missing Svix signature → 400 error
- `user.created` event → welcome email enqueued
- Other event types → 200 OK (no action)
- `AUTH_MODE=local` → endpoint returns early or not mounted
- Structured logging for all webhook events

### Security Considerations

- **Svix signature verification** prevents spoofed webhook events
- **Raw body** must be used for verification (not parsed JSON)
- **No user auth** on endpoint — secured by Svix signature only
- **CLERK_WEBHOOK_SECRET** must be set in production env

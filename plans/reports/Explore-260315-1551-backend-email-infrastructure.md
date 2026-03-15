# Backend Email Infrastructure Exploration Report

**Date:** 2026-03-15  
**Status:** Complete  
**Scope:** Backend email services, queue infrastructure, configuration

---

## 1. Email Service Directory Structure

All email infrastructure files exist in `/Users/typham/Documents/GitHub/Project-Helux/backend/app/services/email/`:

- `__init__.py` — Public API exports
- `email_sender.py` — Contracts/interfaces (sender protocol, request/response types)
- `organization_invite_email.py` — Email template builder
- `queue.py` — Queue payload helpers and enqueue functions
- `resend_sender.py` — Resend provider adapter implementation
- `worker.py` — Async task processor for email sends

---

## 2. ResendInviteEmailSender Class (Full Implementation)

**File:** `resend_sender.py` (88 lines)

```python
class ResendInviteEmailSender(InviteEmailSender):
    """Resend-backed invite email sender."""

    def __init__(
        self,
        *,
        api_key: str,
        sender: str,
        reply_to: str | None,
        send_email: Callable[[dict[str, object], dict[str, str] | None], Any] | None = None,
    ) -> None:
        self._sender = sender
        self._reply_to = reply_to.strip() if reply_to else ""

        if send_email is not None:
            self._send_email = send_email
            return

        import resend

        resend.api_key = api_key
        self._send_email = resend.Emails.send  # type: ignore[assignment]

    async def send_organization_invite_email(
        self,
        request: OrganizationInviteEmailSendRequest,
    ) -> None:
        payload: dict[str, object] = {
            "from": self._sender,
            "to": [request.invited_email],
            "subject": request.content.subject,
            "html": request.content.html,
            "text": request.content.text,
        }
        if self._reply_to:
            payload["reply_to"] = self._reply_to

        options = {"idempotency_key": request.idempotency_key}
        try:
            await asyncio.to_thread(self._send_email, payload, options)
        except Exception as exc:  # pragma: no cover - defensive provider boundary
            retryable = _is_retryable_resend_error(exc)
            logger.warning(
                "email.invite.send_failed",
                extra={
                    "invite_id": str(request.invite_id),
                    "organization_id": str(request.organization_id),
                    "retryable": retryable,
                    "error_type": type(exc).__name__,
                },
            )
            raise InviteEmailDeliveryError(str(exc), retryable=retryable) from exc
```

**Key Points:**
- Implements `InviteEmailSender` protocol
- Supports dependency injection of `send_email` callable (for testing)
- Falls back to `resend.Emails.send` if no mock provided
- Async wrapper using `asyncio.to_thread()` to handle sync Resend API
- Idempotency support via `idempotency_key` (hash of invite_id + send_key)
- Retryable error detection (408, 409, 425, 429, 500-504 HTTP codes + network errors)
- All errors raised as `InviteEmailDeliveryError` with retryability flag

---

## 3. Invite Email Template Pattern

**File:** `organization_invite_email.py` (120 lines)

**Input Model:**
```python
@dataclass(frozen=True)
class OrganizationInviteEmailRenderInput:
    organization_name: str
    invite_token: str
    invite_accept_base_url: str
```

**Output Model:**
```python
@dataclass(frozen=True)
class OrganizationInviteEmailContent:
    subject: str
    text: str
    html: str
```

**Main Function:**
```python
def build_organization_invite_email(
    payload: OrganizationInviteEmailRenderInput,
) -> tuple[OrganizationInviteEmailContent, str]:
    """Return invite email content and accept URL."""
```

**Template Features:**
- Professional HTML email with table-based layout (email client compatibility)
- Subject: `"You're invited to join {org_name} on FlowGrid"`
- Plain text fallback with accept URL
- HTML features:
  - Slate-900/100 color scheme (dark blue gradient header)
  - 520px container (responsive 40px padding)
  - CTA button: "Accept Invite" with dark background
  - Fallback URL display (click-through safety)
  - Footer with disclaimer
  - Proper HTML structure with charset/viewport meta tags
  - XSS protection via `html.escape()` on org name and URL
- URL building: Safely appends/updates `?token=` query parameter via `urlparse/urlencode`
- Fallback org name: `"your organization"` if blank

---

## 4. Invite Email Sender Contracts

**File:** `email_sender.py` (46 lines)

**Key Types:**

```python
@dataclass(frozen=True)
class OrganizationInviteEmailContent:
    subject: str
    text: str
    html: str

@dataclass(frozen=True)
class OrganizationInviteEmailSendRequest:
    invite_id: UUID
    organization_id: UUID
    invited_email: str
    idempotency_key: str
    content: OrganizationInviteEmailContent

class InviteEmailDeliveryError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable

class InviteEmailSender(Protocol):
    async def send_organization_invite_email(
        self,
        request: OrganizationInviteEmailSendRequest,
    ) -> None:
        """Send one organization invite email."""
```

**Design:**
- Protocol-based (duck-typing friendly)
- Request bundles all send params (IDs, email, content, idempotency key)
- Error type carries retryability hint for queue workers
- Immutable frozen dataclasses for type safety

---

## 5. Queue/Worker Pattern

### 5a. Queue Module (`queue.py` - 90 lines)

**Queued Task Model:**
```python
@dataclass(frozen=True)
class QueuedOrganizationInviteEmail:
    invite_id: UUID
    send_key: str        # Unique per send attempt
    trigger: str        # "api" | "manual" | "unknown"
    attempts: int = 0
```

**Task Type Constant:**
```python
TASK_TYPE = "organization_invite_email_send"
```

**Public API Functions:**

1. **`enqueue_invite_email_send(invite_id: UUID, trigger: str) -> bool`**
   - Creates new task with random `send_key` (uuid4.hex)
   - Enqueues to Redis RQ with settings queue name
   - Logs at info level on success
   - Returns success boolean

2. **`decode_invite_email_task(task: QueuedTask) -> QueuedOrganizationInviteEmail`**
   - Deserializes from Redis `QueuedTask` format
   - Supports legacy task_type fallback
   - Generates random send_key if missing
   - Extracts attempts from task payload

3. **`requeue_invite_email_task(task: QueuedTask, delay_seconds: float = 0) -> bool`**
   - Wrapper around `generic_requeue_if_failed()`
   - Caps retries at `settings.rq_dispatch_max_retries` (3 by default)
   - Respects delay parameter

**Serialization:**
```python
def _task_from_payload(payload: QueuedOrganizationInviteEmail) -> QueuedTask:
    return QueuedTask(
        task_type=TASK_TYPE,
        payload={
            "invite_id": str(payload.invite_id),
            "send_key": payload.send_key,
            "trigger": payload.trigger,
        },
        created_at=utcnow(),
        attempts=payload.attempts,
    )
```

**Logging:**
- Enqueue success: `"email.invite.queue.enqueued"` with invite_id, trigger

---

### 5b. Worker Module (`worker.py` - 138 lines)

**Main Handler:**
```python
async def process_invite_email_task(task: QueuedTask) -> None:
    """Process one invite email send task."""
```

**Execution Flow:**

1. **Decode Task**
   - Extract invite_id, send_key, trigger from QueuedTask

2. **Get Sender**
   - Check `settings.email_provider` ("none" or "resend")
   - Return None if "none" (provider disabled)
   - Create `ResendInviteEmailSender` with API key, sender, reply_to

3. **Fetch Data (Database)**
   - Load `OrganizationInvite` by invite_id
   - Skip if invite not found (warning log)
   - Skip if invite already accepted (info log)
   - Load `Organization` by invite.organization_id
   - Skip if organization not found (warning log)

4. **Build Content**
   - Call `build_organization_invite_email()` with:
     - org.name
     - invite.token
     - settings.invite_accept_base_url
   - Returns (content, accept_url)

5. **Create Send Request**
   - Idempotency key: SHA256 hash of `"organization-invite:{invite_id}:{send_key}"`
   - Include all IDs, email, content

6. **Send Email**
   - Call `sender.send_organization_invite_email(request)`
   - Catch `InviteEmailDeliveryError`
   - Re-raise as RuntimeError if retryable (worker will requeue)
   - Return silently if non-retryable (drop task)

7. **Logging (Detailed)**
   - Enqueue skips: `"email.invite.send_skipped_provider_disabled"`, etc.
   - Start: `"email.invite.send_started"` with attempt number
   - Failure: `"email.invite.send_failed"` with retryable flag
   - Success: `"email.invite.send_succeeded"`

**Provider Factory:**
```python
def get_invite_email_sender() -> InviteEmailSender | None:
    provider = settings.email_provider
    if provider == "none":
        return None
    if provider != "resend":
        raise RuntimeError(f"Unsupported email provider: {provider}")
    return ResendInviteEmailSender(
        api_key=settings.resend_api_key,
        sender=settings.email_from_invites,
        reply_to=settings.email_reply_to or None,
    )
```

---

## 6. Task Handler Registration

**File:** `backend/app/services/queue_worker.py` (222 lines)

**Handler Registry Pattern:**

```python
@dataclass(frozen=True)
class _TaskHandler:
    handler: Callable[[QueuedTask], Awaitable[None]]
    attempts_to_delay: Callable[[int], float]
    requeue: Callable[[QueuedTask, float], bool]

_TASK_HANDLERS: dict[str, _TaskHandler] = {
    ORG_INVITE_EMAIL_TASK_TYPE: _TaskHandler(
        handler=process_invite_email_task,
        attempts_to_delay=lambda attempts: min(
            settings.rq_dispatch_retry_base_seconds * (2 ** max(0, attempts)),
            settings.rq_dispatch_retry_max_seconds,
        ),
        requeue=lambda task, delay: requeue_invite_email_task(task, delay_seconds=delay),
    ),
    # ... 5 other task types (file extract, gateway activation, etc.)
}
```

**Worker Loop:**

```python
async def flush_queue(*, block: bool = False, block_timeout: float = 0) -> int:
    """Consume one queue batch and dispatch by task type."""
    processed = 0
    while True:
        task = dequeue_task(...)  # Get from Redis
        if task is None:
            break
        
        handler = _TASK_HANDLERS.get(task.task_type)
        if handler is None:
            logger.warning("queue.worker.task_unhandled", ...)
            continue
        
        try:
            await handler.handler(task)
            processed += 1
            logger.info("queue.worker.success", ...)
        except Exception as exc:
            base_delay = handler.attempts_to_delay(task.attempts)
            delay = base_delay + _compute_jitter(base_delay)
            if not handler.requeue(task, delay):
                logger.warning("queue.worker.drop_task", ...)
        
        await asyncio.sleep(settings.rq_dispatch_throttle_seconds)
    return processed
```

**Retry Strategy:**
- Exponential backoff: `10 * 2^attempts` seconds
- Capped at 120 seconds max
- Random jitter: ±10% of base delay
- Max retries: 3 (configurable)
- Worker heartbeat: Published every 5 seconds to Redis

**Task Types Registered:**
1. `"organization_invite_email_send"` → `process_invite_email_task`
2. `"board_chat_file_extract"` → `process_extraction_task`
3. `"gateway_activation"` → `process_gateway_activation_task`
4. `"lifecycle_reconcile"` → `process_lifecycle_queue_task`
5. `"report_deadline"` → `process_report_deadline_task`
6. `"webhook_dispatch"` → `process_webhook_queue_task`

---

## 7. Router Registration

**File:** `backend/app/main.py` (626 lines)

**Pattern:**
```python
api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(auth_router)
api_v1.include_router(agent_router)
# ... 25 total routers included
app.include_router(api_v1)
```

**Routers Included:**
- auth, agent, agents, activity, gateway, gateways, metrics
- billing, billing_webhooks, onboarding_progress, organizations
- souls_directory, skills_marketplace, board_groups, board_group_memory
- boards, board_memory, board_chat_files, board_chat_sessions
- board_webhooks, board_onboarding, approvals, tasks
- task_custom_fields, tags, users, workspace_templates

**Note:** Email invite endpoints are not explicitly visible in main.py (likely in organization/auth routers). Queue is background-only.

---

## 8. Settings Pattern & Configuration

**File:** `backend/app/core/config.py` (301 lines)

**Settings Class: `Settings(BaseSettings)`**

**Email-Specific Fields:**
```python
# Email provider (organization invite delivery)
email_provider: str = "none"                    # Must be "none" or "resend"
resend_api_key: str = ""                        # Required if provider=resend
resend_webhook_secret: str = ""
email_from_invites: str = ""                    # Required if provider=resend
email_reply_to: str = ""                        # Optional
invite_accept_base_url: str = ""                # Required if provider=resend
```

**Validation Rules (in `@model_validator`):**
```python
if self.email_provider == "resend":
    if not self.resend_api_key.strip():
        raise ValueError("RESEND_API_KEY required when EMAIL_PROVIDER=resend.")
    if not self.email_from_invites:
        raise ValueError("EMAIL_FROM_INVITES required when EMAIL_PROVIDER=resend.")
    if not self.invite_accept_base_url:
        raise ValueError("INVITE_ACCEPT_BASE_URL required when EMAIL_PROVIDER=resend.")

if self.invite_accept_base_url:
    parsed_invite_url = urlparse(self.invite_accept_base_url)
    if parsed_invite_url.scheme not in {"http", "https"} or not parsed_invite_url.netloc:
        raise ValueError(
            "INVITE_ACCEPT_BASE_URL must be an absolute http(s) URL.",
        )
    self.invite_accept_base_url = self.invite_accept_base_url.rstrip("/")
```

**Queue-Related Fields:**
```python
rq_redis_url: str = "redis://localhost:6379/0"
rq_queue_name: str = "default"
rq_dispatch_throttle_seconds: float = 15.0
rq_dispatch_max_retries: int = 3
rq_dispatch_retry_base_seconds: float = 10.0
rq_dispatch_retry_max_seconds: float = 120.0
worker_heartbeat_key: str = ""
worker_heartbeat_ttl_seconds: int = Field(default=300, ge=5)
```

**Base Fields:**
```python
environment: str = "dev"
database_url: str
auth_profile: AuthProfile
auth_mode: AuthMode
base_url: str  # REQUIRED
cors_origins: str
log_level: str = "INFO"
log_format: str = "text"
# ... 40+ more fields for auth, billing, storage, gateways, etc.
```

**Model Configuration:**
```python
model_config = SettingsConfigDict(
    env_file=[DEFAULT_ENV_FILE, ".env"],
    env_file_encoding="utf-8",
    extra="ignore",
)
```

Loads from `backend/.env` file, falls back to system env vars.

---

## 9. Dependencies

**File:** `backend/pyproject.toml` (87 lines)

**Email-Related Dependencies:**
```toml
resend>=2.23.0,<3
```

**Core Dependencies:**
- FastAPI 0.131.0
- SQLAlchemy 2.0.46 (async)
- Pydantic 2.x (settings)
- Redis 6.3.0 (queue backend)
- RQ 2.6.0 (job queueing)
- Alembic 1.18.3 (migrations)
- Clerk 4.2.0 (auth)
- Uvicorn 0.40.0 (ASGI)

**Python Version:** ≥3.12

---

## 10. Environment Variables

**File:** `backend/.env.example` (142 lines)

**Email Configuration Section:**
```
# --- Invite email (organization invite delivery only) ---
# EMAIL_PROVIDER=none|resend
EMAIL_PROVIDER=none
# RESEND_API_KEY=re_xxx
# RESEND_WEBHOOK_SECRET=whsec_xxx
# EMAIL_FROM_INVITES=FlowGrid <noreply@example.com>
# EMAIL_REPLY_TO=support@example.com
# INVITE_ACCEPT_BASE_URL=http://localhost:3000/invite
```

**Queue Configuration Section:**
```
# --- Redis / RQ queue ---
RQ_REDIS_URL=redis://localhost:6379/0
RQ_QUEUE_NAME=default
RQ_DISPATCH_THROTTLE_SECONDS=15.0
RQ_DISPATCH_MAX_RETRIES=3
RQ_DISPATCH_RETRY_BASE_SECONDS=10.0
RQ_DISPATCH_RETRY_MAX_SECONDS=120.0

# --- Worker & readiness ---
WORKER_HEARTBEAT_KEY=mission-control:worker:heartbeat
WORKER_HEARTBEAT_TTL_SECONDS=300
```

**Default Email State:** `EMAIL_PROVIDER=none` (provider disabled by default)

---

## Summary

### Architecture Highlights

1. **Separation of Concerns:**
   - `email_sender.py` — Contracts only
   - `resend_sender.py` — Provider implementation
   - `organization_invite_email.py` — Template/rendering
   - `queue.py` — Queuing contracts
   - `worker.py` — Async processing
   - `queue_worker.py` — Dispatcher loop

2. **Provider Pattern:**
   - Protocol-based sender interface
   - Easily swappable providers (Resend only today, extensible)
   - Idempotency via SHA256(invite_id:send_key)
   - Provider can be disabled entirely

3. **Queue/Worker Pattern:**
   - Redis RQ for persistence
   - Exponential backoff with jitter
   - Retryable vs. non-retryable error handling
   - Task-type dispatch registry
   - Worker heartbeat for liveness
   - 6 registered task types (email is one)

4. **Email Template:**
   - Professional HTML with email client compatibility
   - XSS-safe (escaped HTML entities)
   - Responsive (520px container)
   - Plain text fallback
   - URL safety (proper encoding)

5. **Configuration:**
   - Strict validation (email_provider=resend requires all 3 env vars)
   - Flexible auth modes (Clerk or local token)
   - Comprehensive logging
   - Feature flags for rollout control

### Production Readiness

✓ Idempotency support (prevents duplicate sends)  
✓ Retry with exponential backoff  
✓ Error classification (retryable vs. fatal)  
✓ Database lookups (checks invite accepted before sending)  
✓ Comprehensive logging (info, warning, error)  
✓ Configuration validation  
✓ XSS/injection protection  
✓ Async execution (non-blocking)  

---

**Report Generated:** 2026-03-15 15:51 UTC  
**Files Analyzed:** 10  
**Total Lines of Code Reviewed:** ~900

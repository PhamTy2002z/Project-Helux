---
phase: 2
status: pending
priority: P0
effort: M
depends_on: [1]
---

# Phase 2: Webhook Event Storage & Async Processing

## Context
- [Payment System Review](../reports/brainstorm-260317-1507-payment-billing-review.md) — "Fire-and-Forget Webhooks" anti-pattern
- Currently: webhook processed inline, no raw payload stored, failed events lost forever

## Overview

Implement **store-then-process** pattern: persist raw webhook payload → return 200 immediately → process async via RQ worker.

## Key Insights

- Polar retries webhooks on non-2xx responses (timeout ~30s)
- Current inline processing risks timeout on DB-heavy operations
- No ability to replay failed webhooks currently
- RQ worker infrastructure already exists (email delivery uses it)

## Architecture

```
Polar → POST /webhooks/polar
         │
         ├─ 1. Verify signature
         ├─ 2. INSERT into polar_webhook_events (raw payload)
         ├─ 3. Return {"status": "accepted"} (200)
         │
         └─ 4. Enqueue RQ task: process_webhook_event(event_id)
                  │
                  └─ Worker picks up
                       ├─ Load raw event from DB
                       ├─ Process (update plan, send email, etc.)
                       └─ Mark processed_at timestamp
```

## Related Code Files

**Create:**
- `backend/app/models/polar_webhook_events.py` — new model
- `backend/app/services/billing_webhook_queue.py` — queue enqueue helper
- `backend/migrations/versions/xxxx_add_polar_webhook_events.py` — migration

**Modify:**
- `backend/app/api/billing_webhooks.py` — store-then-enqueue
- `backend/app/services/billing_webhook_service.py` — load from DB instead of inline event

## Implementation Steps

### 2.1 Create PolarWebhookEvent model

File: `backend/app/models/polar_webhook_events.py`

```python
class PolarWebhookEvent(QueryModel, table=True):
    """Raw Polar webhook event storage for replay and audit."""

    __tablename__ = "polar_webhook_events"
    __table_args__ = (
        UniqueConstraint("polar_event_id", name="uq_polar_webhook_events_polar_event_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    event_type: str = Field(index=True)                    # e.g. "subscription.active"
    polar_event_id: str | None = Field(default=None, index=True)  # UNIQUE for dedup (FINDING-02)
    raw_payload: dict[str, Any] | None = Field(
        default=None, sa_column=Column("raw_payload", JSON),
    )
    organization_id: UUID | None = Field(default=None, index=True)  # extracted from metadata
    status: str = Field(default="pending", index=True)     # pending | processed | failed | skipped
    error_message: str | None = None
    attempts: int = Field(default=0)
    received_at: datetime = Field(default_factory=utcnow)
    processed_at: datetime | None = None
```

**FINDING-02 fix**: `polar_event_id` has UNIQUE constraint. Duplicate webhooks from Polar retries are caught at DB level.

### 2.2 Create Alembic migration

```bash
cd backend && alembic revision --autogenerate -m "add_polar_webhook_events_table"
```

Verify generated migration includes:
- Table `polar_webhook_events`
- Indexes on `event_type`, `polar_event_id`, `organization_id`, `status`

### 2.3 Update webhook receiver (store-then-enqueue)

File: `backend/app/api/billing_webhooks.py`

```python
@router.post("/polar")
async def handle_polar_webhook(request, session):
    # 1. Verify signature (unchanged)
    event = validate_event(...)

    # 2. Extract metadata for indexing
    event_type = getattr(event, "type", "")
    event_data = getattr(event, "data", None)
    metadata = _safe_get(event_data, "metadata") if event_data else None
    org_id = _extract_org_id(metadata)
    polar_event_id = str(getattr(event_data, "id", "") or "")

    # 3. Store raw event (dedup via UNIQUE constraint on polar_event_id)
    from sqlalchemy.exc import IntegrityError
    from app.models.polar_webhook_events import PolarWebhookEvent

    webhook_event = PolarWebhookEvent(
        event_type=event_type,
        polar_event_id=polar_event_id or None,
        raw_payload=_serialize_event(event),
        organization_id=org_id,
        status="pending",
    )
    session.add(webhook_event)
    try:
        await session.commit()
    except IntegrityError:
        # Duplicate polar_event_id — Polar retry, already stored
        await session.rollback()
        logger.info("Duplicate Polar webhook %s, skipping", polar_event_id)
        return {"status": "duplicate"}

    await session.refresh(webhook_event)

    # 4. Enqueue async processing
    from app.services.billing_webhook_queue import enqueue_billing_webhook_task
    enqueue_billing_webhook_task(webhook_event_id=webhook_event.id)

    return {"status": "accepted"}
```

**FINDING-02 fix**: IntegrityError on duplicate `polar_event_id` → return "duplicate" immediately.

### 2.4 Create webhook queue module (FINDING-03 fix)

File: `backend/app/services/billing_webhook_queue.py`

Follow EXACT pattern from existing queue modules (`email/billing_email_queue.py`, `webhooks/queue.py`):

```python
"""Queue helpers for async Polar webhook processing."""
from __future__ import annotations

from uuid import UUID

from app.core.logging import get_logger
from app.services.queue import QueuedTask, enqueue_task, enqueue_task_with_delay

logger = get_logger(__name__)
TASK_TYPE = "billing_webhook_process"


def enqueue_billing_webhook_task(*, webhook_event_id: UUID) -> None:
    """Enqueue a Polar webhook event for async processing."""
    task = QueuedTask(
        task_type=TASK_TYPE,
        payload={"webhook_event_id": str(webhook_event_id)},
    )
    enqueue_task(task)
    logger.info("Enqueued billing webhook task for event %s", webhook_event_id)


def requeue_billing_webhook_task(task: QueuedTask, *, delay_seconds: float = 0) -> bool:
    """Re-enqueue a failed webhook task with delay."""
    if task.attempts >= 5:
        logger.warning("Dropping billing webhook task after %d attempts", task.attempts)
        return False
    enqueue_task_with_delay(task, delay_seconds=delay_seconds)
    return True


def decode_billing_webhook_task(task: QueuedTask) -> UUID:
    """Decode webhook_event_id from queued task."""
    if task.task_type != TASK_TYPE:
        raise ValueError(f"Unexpected task_type={task.task_type!r}")
    return UUID(task.payload["webhook_event_id"])
```

### 2.5 Create webhook worker module

File: `backend/app/services/billing_webhook_worker.py`

```python
"""Worker for processing stored Polar webhook events."""
from __future__ import annotations

from app.core.logging import get_logger
from app.db.session import get_async_session_context
from app.services.billing_webhook_queue import decode_billing_webhook_task
from app.services.queue import QueuedTask

logger = get_logger(__name__)


async def process_billing_webhook_task(task: QueuedTask) -> None:
    """Load stored webhook event and process it."""
    webhook_event_id = decode_billing_webhook_task(task)

    async with get_async_session_context() as session:
        from app.models.polar_webhook_events import PolarWebhookEvent
        from app.services.billing_webhook_service import process_stored_event
        from app.core.time import utcnow

        event_record = await PolarWebhookEvent.objects.filter_by(
            id=webhook_event_id
        ).first(session)

        if event_record is None:
            logger.warning("Webhook event %s not found", webhook_event_id)
            return
        if event_record.status == "processed":
            logger.info("Webhook event %s already processed", webhook_event_id)
            return

        try:
            await process_stored_event(session, event_record=event_record)
            event_record.status = "processed"
            event_record.processed_at = utcnow()
        except Exception as exc:
            event_record.status = "failed"
            event_record.error_message = str(exc)[:500]
            event_record.attempts += 1
            session.add(event_record)
            await session.commit()
            raise  # Re-raise for queue retry with backoff
        else:
            session.add(event_record)
            await session.commit()
```

### 2.6 Register in queue_worker.py (FINDING-03 fix)

File: `backend/app/services/queue_worker.py`

Add imports at top:
```python
from app.services.billing_webhook_queue import TASK_TYPE as BILLING_WEBHOOK_TASK_TYPE
from app.services.billing_webhook_queue import requeue_billing_webhook_task
from app.services.billing_webhook_worker import process_billing_webhook_task
```

Add entry to `_TASK_HANDLERS`:
```python
BILLING_WEBHOOK_TASK_TYPE: _TaskHandler(
    handler=process_billing_webhook_task,
    attempts_to_delay=lambda attempts: min(
        settings.rq_dispatch_retry_base_seconds * (2 ** max(0, attempts)),
        settings.rq_dispatch_retry_max_seconds,
    ),
    requeue=lambda task, delay: requeue_billing_webhook_task(task, delay_seconds=delay),
),
```

### 2.7 Update billing_webhook_service.py for stored event processing

Add `process_stored_event` function that accepts `PolarWebhookEvent` record instead of raw event object:
```python
async def process_stored_event(
    session: AsyncSession, *, event_record: PolarWebhookEvent
) -> None:
    """Process a stored webhook event record."""
    raw = event_record.raw_payload
    if not raw or not isinstance(raw, dict):
        logger.warning("Empty payload for webhook event %s", event_record.id)
        return

    event_type = event_record.event_type
    if event_type not in HANDLED_EVENTS:
        logger.debug("Ignoring stored event type: %s", event_type)
        return

    # Re-extract org_id and event_data from stored payload
    event_data = raw.get("data", {})
    org_id = event_record.organization_id
    if org_id is None:
        logger.warning("Stored event %s missing organization_id", event_record.id)
        return

    handler = _HANDLERS.get(event_type)
    if handler:
        await handler(session, organization_id=org_id, event_data=event_data)
```

## Todo List

- [ ] 2.1 Create `PolarWebhookEvent` model with UNIQUE constraint on `polar_event_id`
- [ ] 2.2 Generate + review Alembic migration
- [ ] 2.3 Update webhook receiver: store → dedup → enqueue
- [ ] 2.4 Create `billing_webhook_queue.py` (TASK_TYPE, enqueue, requeue, decode)
- [ ] 2.5 Create `billing_webhook_worker.py` (process_billing_webhook_task)
- [ ] 2.6 Register `BILLING_WEBHOOK_TASK_TYPE` in `queue_worker.py` `_TASK_HANDLERS`
- [ ] 2.7 Add `process_stored_event` to `billing_webhook_service.py`
- [ ] 2.8 Run migration locally + verify table created
- [ ] 2.9 Compile check all modified/created files

## Rollback Strategy (FINDING-04)

If async processing causes issues:
1. Revert webhook receiver to call `process_polar_event()` directly (sync fallback)
2. Keep `PolarWebhookEvent` table for audit — just stop enqueuing
3. Unprocessed events can be replayed later by resetting `status=pending`
4. No data loss in either direction — table persists regardless of processing mode

## Success Criteria

- Webhook payload persisted BEFORE processing (store-then-process)
- Duplicate webhooks (same `polar_event_id`) rejected at DB level
- Processing happens async via existing RQ worker infrastructure
- Failed events marked `status=failed` with error message + retry up to 5 attempts
- Events can be replayed by resetting `status=pending`
- Queue registration matches exact `_TaskHandler` pattern from `queue_worker.py`
- Existing webhook logic unchanged (only execution path changed from sync → async)

## Risk Assessment

- **Medium risk**: Changes webhook processing flow from sync → async
- **Mitigation**: Sync fallback documented in rollback strategy
- **Migration**: Non-destructive, adds new table only
- **FINDING-02**: Dedup via UNIQUE constraint + IntegrityError catch
- **FINDING-03**: Queue interface matches existing `QueuedTask` + `_TaskHandler` pattern exactly

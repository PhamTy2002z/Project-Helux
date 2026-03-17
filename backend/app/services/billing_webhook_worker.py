"""Worker for processing stored Polar webhook events."""

from __future__ import annotations

from app.core.logging import get_logger
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.services.billing_webhook_queue import decode_billing_webhook_task
from app.services.queue import QueuedTask

logger = get_logger(__name__)


async def process_billing_webhook_task(task: QueuedTask) -> None:
    """Load stored webhook event and process it."""
    webhook_event_id = decode_billing_webhook_task(task)

    async with async_session_maker() as session:
        from app.models.polar_webhook_events import PolarWebhookEvent

        event_record = await PolarWebhookEvent.objects.filter_by(
            id=webhook_event_id,
        ).first(session)

        if event_record is None:
            logger.warning("Webhook event %s not found", webhook_event_id)
            return
        if event_record.status == "processed":
            logger.info("Webhook event %s already processed", webhook_event_id)
            return

        try:
            from app.services.billing_webhook_service import process_stored_event

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

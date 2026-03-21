"""Polar webhook receiver -- unauthenticated, signature-verified."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import get_session

logger = get_logger(__name__)
router = APIRouter(prefix="/billing/webhooks", tags=["billing-webhooks"])
_WEBHOOK_TOO_LARGE_DETAIL = "Webhook payload too large."


def _content_length_or_none(request: Request) -> int | None:
    raw = request.headers.get("content-length")
    if not raw:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if value < 0:
        return None
    return value


async def _read_webhook_body_limited(request: Request) -> bytes:
    max_bytes = int(settings.inbound_webhook_max_body_bytes)
    if max_bytes <= 0:
        return await request.body()

    content_length = _content_length_or_none(request)
    if content_length is not None and content_length > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=_WEBHOOK_TOO_LARGE_DETAIL,
        )

    chunks: list[bytes] = []
    total_bytes = 0
    async for chunk in request.stream():
        if not chunk:
            continue
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=_WEBHOOK_TOO_LARGE_DETAIL,
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/polar")
async def handle_polar_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Receive and process Polar webhook events (no auth -- signature-verified)."""
    if settings.payment_provider != "polar":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Polar webhooks not enabled.",
        )

    body = await _read_webhook_body_limited(request)
    headers = dict(request.headers)

    # Verify webhook signature
    try:
        from polar_sdk.webhooks import (  # type: ignore[attr-defined]
            WebhookVerificationError,
            validate_event,
        )

        event = validate_event(
            body=body,
            headers=headers,
            secret=settings.polar_webhook_secret,
        )
    except WebhookVerificationError as exc:
        logger.warning("Polar webhook signature failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        ) from exc

    # Store-then-enqueue: persist raw payload first, process async
    from sqlalchemy.exc import IntegrityError

    from app.models.polar_webhook_events import PolarWebhookEvent
    from app.services.billing_webhook_helpers import _extract_org_id, _safe_get

    event_type = getattr(event, "type", "") or ""
    event_data = getattr(event, "data", None)
    metadata = _safe_get(event_data, "metadata") if event_data else None
    if isinstance(metadata, str):
        import json

        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = None
    org_id = _extract_org_id(metadata if isinstance(metadata, dict) else None)
    # Use event data ID if available, else hash raw body for dedup (C-1 fix)
    raw_event_id = str(_safe_get(event_data, "id") or "").strip()
    if raw_event_id:
        polar_event_id: str | None = raw_event_id
    else:
        import hashlib

        polar_event_id = f"hash-{hashlib.sha256(body).hexdigest()}"

    # Serialize event to JSON-safe dict
    raw_payload: dict[str, object] = {}
    try:
        raw_payload = {
            "type": event_type,
            "data": event_data if isinstance(event_data, dict) else {},
        }
        if hasattr(event_data, "model_dump"):
            raw_payload["data"] = event_data.model_dump(mode="json")  # type: ignore[union-attr]
        elif hasattr(event_data, "__dict__"):
            import json as _json

            raw_payload["data"] = _json.loads(_json.dumps(event_data.__dict__, default=str))
    except Exception:
        logger.warning("Failed to serialize webhook event data", exc_info=True)

    webhook_event = PolarWebhookEvent(
        event_type=event_type,
        polar_event_id=polar_event_id,
        raw_payload=raw_payload,
        organization_id=org_id,
        status="pending",
    )
    session.add(webhook_event)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        logger.info("Duplicate Polar webhook %s, skipping", polar_event_id)
        return {"status": "duplicate"}

    await session.refresh(webhook_event)

    # Enqueue async processing
    from app.services.billing_webhook_queue import enqueue_billing_webhook_task

    enqueued = enqueue_billing_webhook_task(webhook_event_id=webhook_event.id)
    if not enqueued:
        logger.error(
            "Failed to enqueue billing webhook task for event %s (stored but unprocessed)",
            webhook_event.id,
        )

    return {"status": "accepted"}

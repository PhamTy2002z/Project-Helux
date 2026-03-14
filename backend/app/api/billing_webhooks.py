"""Polar webhook receiver -- unauthenticated, signature-verified."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import get_session

logger = get_logger(__name__)
router = APIRouter(prefix="/billing/webhooks", tags=["billing-webhooks"])


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

    body = await request.body()
    headers = dict(request.headers)

    # Verify webhook signature
    try:
        from polar_sdk.webhooks import validate_event  # type: ignore[attr-defined]

        event = validate_event(
            body=body,
            headers=headers,
            secret=settings.polar_webhook_secret,
        )
    except Exception as exc:
        logger.warning("Polar webhook signature verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        ) from exc

    # Process event
    from app.services.billing_webhook_service import process_polar_event

    await process_polar_event(session, event=event)
    return {"status": "ok"}

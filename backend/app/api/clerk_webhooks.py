"""Clerk webhook receiver for user lifecycle events."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app.core.auth_mode import AuthMode
from app.core.config import settings
from app.core.logging import get_logger
from app.services.email.welcome_email_queue import enqueue_welcome_email_send

logger = get_logger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def handle_clerk_webhook(request: Request) -> JSONResponse:
    """Receive Clerk webhook events and dispatch handlers."""
    # Guard: only process when AUTH_MODE=clerk
    if settings.auth_mode != AuthMode.CLERK:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": "auth_mode_not_clerk"},
        )

    secret = settings.clerk_webhook_secret.strip()
    if not secret:
        logger.warning("webhook.clerk.no_secret_configured")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"status": "ignored", "reason": "no_webhook_secret"},
        )

    # Read raw body for Svix signature verification
    body = await request.body()
    headers: dict[str, str] = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    # Verify Svix signature
    try:
        from svix.webhooks import Webhook

        wh = Webhook(secret)
        payload = wh.verify(body, headers)
    except Exception as exc:
        logger.warning(
            "webhook.clerk.signature_invalid",
            extra={"error": str(exc)},
        )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "invalid_signature"},
        )

    event_type = payload.get("type", "")
    logger.info(
        "webhook.clerk.event_received",
        extra={"event_type": event_type},
    )

    if event_type == "user.created":
        _handle_user_created(payload)
    # Other event types are acknowledged but ignored

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "ok"},
    )


def _handle_user_created(payload: dict[str, Any]) -> None:
    """Extract user info from user.created event and enqueue welcome email."""
    data = payload.get("data", {})
    user_id = str(data.get("id", ""))

    # Extract primary email
    email_addresses = data.get("email_addresses", [])
    primary_email = ""
    for addr in email_addresses:
        if isinstance(addr, dict):
            if addr.get("id") == data.get("primary_email_address_id"):
                primary_email = addr.get("email_address", "")
                break
    # Fallback: use first email if no primary match
    if not primary_email and email_addresses:
        first = email_addresses[0]
        if isinstance(first, dict):
            primary_email = first.get("email_address", "")

    if not primary_email:
        logger.warning(
            "webhook.clerk.user_created_no_email",
            extra={"user_id": user_id},
        )
        return

    first_name = str(data.get("first_name") or "")

    logger.info(
        "webhook.clerk.user_created_enqueue",
        extra={"user_id": user_id},
    )
    enqueue_welcome_email_send(
        user_email=primary_email,
        user_id=user_id,
        first_name=first_name,
        trigger="clerk_webhook",
    )

"""Worker handler for asynchronous welcome email delivery."""

from __future__ import annotations

from hashlib import sha256

from app.core.config import settings
from app.core.logging import get_logger
from app.services.email.resend_sender import ResendWelcomeEmailSender
from app.services.email.welcome_email import WelcomeEmailRenderInput, build_welcome_email
from app.services.email.welcome_email_queue import decode_welcome_email_task
from app.services.email.welcome_email_sender import (
    WelcomeEmailDeliveryError,
    WelcomeEmailSender,
    WelcomeEmailSendRequest,
)
from app.services.queue import QueuedTask

logger = get_logger(__name__)


def _idempotency_key(*, user_id: str, send_key: str) -> str:
    return sha256(f"welcome-email:{user_id}:{send_key}".encode("utf-8")).hexdigest()


def get_welcome_email_sender() -> WelcomeEmailSender | None:
    provider = settings.email_provider
    if provider == "none":
        return None
    if provider != "resend":
        raise RuntimeError(f"Unsupported email provider: {provider}")
    return ResendWelcomeEmailSender(
        api_key=settings.resend_api_key,
        sender=settings.email_from_invites,
        reply_to=settings.email_reply_to or None,
    )


async def process_welcome_email_task(task: QueuedTask) -> None:
    """Process one welcome email send task."""
    payload = decode_welcome_email_task(task)
    sender = get_welcome_email_sender()
    if sender is None:
        logger.info(
            "email.welcome.send_skipped_provider_disabled",
            extra={
                "user_id": payload.user_id,
                "trigger": payload.trigger,
            },
        )
        return

    # Build dashboard URL from base_url
    dashboard_url = f"{settings.base_url.rstrip('/')}"

    content = build_welcome_email(
        WelcomeEmailRenderInput(
            first_name=payload.first_name,
            dashboard_url=dashboard_url,
        )
    )
    request = WelcomeEmailSendRequest(
        user_email=payload.user_email,
        user_id=payload.user_id,
        idempotency_key=_idempotency_key(
            user_id=payload.user_id,
            send_key=payload.send_key,
        ),
        content=content,
    )

    logger.info(
        "email.welcome.send_started",
        extra={
            "user_id": payload.user_id,
            "trigger": payload.trigger,
            "attempt": task.attempts,
        },
    )
    try:
        await sender.send_welcome_email(request)
    except WelcomeEmailDeliveryError as exc:
        logger.warning(
            "email.welcome.send_failed",
            extra={
                "user_id": payload.user_id,
                "trigger": payload.trigger,
                "attempt": task.attempts,
                "retryable": exc.retryable,
                "error": str(exc),
            },
        )
        if exc.retryable:
            raise RuntimeError(str(exc)) from exc
        return

    logger.info(
        "email.welcome.send_succeeded",
        extra={
            "user_id": payload.user_id,
            "trigger": payload.trigger,
            "attempt": task.attempts,
        },
    )

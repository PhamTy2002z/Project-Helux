"""Worker handler for asynchronous billing email delivery."""

from __future__ import annotations

from hashlib import sha256
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.services.email.billing_email import (
    build_payment_failed_email,
    build_trial_expiring_email,
    build_upgrade_confirmed_email,
)
from app.services.email.billing_email_queue import decode_billing_email_task
from app.services.email.billing_email_sender import (
    BillingEmailDeliveryError,
    BillingEmailSender,
    BillingEmailSendRequest,
)
from app.services.email.resend_sender import ResendBillingEmailSender
from app.services.queue import QueuedTask

logger = get_logger(__name__)


def _idempotency_key(*, org_id: UUID, email_type: str, event_id: str) -> str:
    return sha256(f"billing:{email_type}:{org_id}:{event_id}".encode("utf-8")).hexdigest()


def get_billing_email_sender() -> BillingEmailSender | None:
    provider = settings.email_provider
    if provider == "none":
        return None
    if provider != "resend":
        raise RuntimeError(f"Unsupported email provider: {provider}")
    return ResendBillingEmailSender(
        api_key=settings.resend_api_key,
        sender=settings.email_from_invites,
        reply_to=settings.email_reply_to or None,
    )


async def _get_org_admin_email(session: AsyncSession, organization_id: UUID) -> str | None:
    """Look up the admin email for an organization."""
    from sqlmodel import col, select

    from app.models.organization_members import OrganizationMember
    from app.models.users import User

    result = await session.exec(
        select(User.email)
        .join(OrganizationMember, col(OrganizationMember.user_id) == col(User.id))
        .where(col(OrganizationMember.organization_id) == organization_id)
        .where(col(OrganizationMember.role) == "admin")
        .limit(1)
    )
    return result.first()


async def _get_org_name(session: AsyncSession, organization_id: UUID) -> str:
    """Look up the organization name."""
    from sqlmodel import col, select

    from app.models.organizations import Organization

    result = await session.exec(
        select(Organization.name).where(col(Organization.id) == organization_id).limit(1)
    )
    name = result.first()
    return name or "your organization"


async def process_billing_email_task(task: QueuedTask) -> None:
    """Process one billing email send task."""
    from app.db.session import async_session_maker

    payload = decode_billing_email_task(task)
    sender = get_billing_email_sender()
    if sender is None:
        logger.info(
            "email.billing.send_skipped_provider_disabled",
            extra={
                "organization_id": str(payload.organization_id),
                "email_type": payload.email_type,
            },
        )
        return

    async with async_session_maker() as session:
        admin_email = await _get_org_admin_email(session, payload.organization_id)
        if not admin_email:
            logger.warning(
                "email.billing.no_admin_email",
                extra={"organization_id": str(payload.organization_id)},
            )
            return
        org_name = await _get_org_name(session, payload.organization_id)

    dashboard_url = settings.base_url.rstrip("/")
    upgrade_url = f"{dashboard_url}/checkout/pro"

    # Build email content based on type
    if payload.email_type == "upgrade_confirmed":
        content = build_upgrade_confirmed_email(org_name=org_name, dashboard_url=dashboard_url)
    elif payload.email_type == "trial_expiring":
        content = build_trial_expiring_email(
            org_name=org_name, days_remaining=3, upgrade_url=upgrade_url
        )
    elif payload.email_type == "payment_failed":
        # Use settings page as portal fallback (portal URL is ephemeral/Polar-generated)
        portal_fallback = f"{dashboard_url}/settings"
        content = build_payment_failed_email(org_name=org_name, portal_url=portal_fallback)
    else:
        logger.warning("email.billing.unknown_type", extra={"email_type": payload.email_type})
        return

    request = BillingEmailSendRequest(
        organization_id=payload.organization_id,
        recipient_email=admin_email,
        email_type=payload.email_type,
        idempotency_key=_idempotency_key(
            org_id=payload.organization_id,
            email_type=payload.email_type,
            event_id=payload.event_id,
        ),
        content=content,
    )

    logger.info(
        "email.billing.send_started",
        extra={
            "organization_id": str(payload.organization_id),
            "email_type": payload.email_type,
            "attempt": task.attempts,
        },
    )
    try:
        await sender.send_billing_email(request)
    except BillingEmailDeliveryError as exc:
        logger.warning(
            "email.billing.send_failed",
            extra={
                "organization_id": str(payload.organization_id),
                "email_type": payload.email_type,
                "attempt": task.attempts,
                "retryable": exc.retryable,
                "error": str(exc),
            },
        )
        if exc.retryable:
            raise RuntimeError(str(exc)) from exc
        return

    logger.info(
        "email.billing.send_succeeded",
        extra={
            "organization_id": str(payload.organization_id),
            "email_type": payload.email_type,
            "attempt": task.attempts,
        },
    )

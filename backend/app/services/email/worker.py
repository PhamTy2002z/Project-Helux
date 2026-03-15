"""Worker handlers for asynchronous organization invite email delivery."""

from __future__ import annotations

from hashlib import sha256

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import async_session_maker
from app.models.organization_invites import OrganizationInvite
from app.models.organizations import Organization
from app.services.email.email_sender import (
    InviteEmailDeliveryError,
    InviteEmailSender,
    OrganizationInviteEmailSendRequest,
)
from app.services.email.organization_invite_email import (
    OrganizationInviteEmailRenderInput,
    build_organization_invite_email,
)
from app.services.email.queue import decode_invite_email_task
from app.services.email.resend_sender import ResendInviteEmailSender
from app.services.queue import QueuedTask

logger = get_logger(__name__)


def _idempotency_key(*, invite_id: str, send_key: str) -> str:
    return sha256(f"organization-invite:{invite_id}:{send_key}".encode("utf-8")).hexdigest()


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


async def process_invite_email_task(task: QueuedTask) -> None:
    payload = decode_invite_email_task(task)
    sender = get_invite_email_sender()
    if sender is None:
        logger.info(
            "email.invite.send_skipped_provider_disabled",
            extra={
                "invite_id": str(payload.invite_id),
                "trigger": payload.trigger,
            },
        )
        return

    async with async_session_maker() as session:
        invite = await OrganizationInvite.objects.by_id(payload.invite_id).first(session)
        if invite is None:
            logger.warning(
                "email.invite.send_skipped_invite_missing",
                extra={"invite_id": str(payload.invite_id)},
            )
            return
        if invite.accepted_at is not None:
            logger.info(
                "email.invite.send_skipped_invite_accepted",
                extra={"invite_id": str(invite.id)},
            )
            return

        organization = await Organization.objects.by_id(invite.organization_id).first(session)
        if organization is None:
            logger.warning(
                "email.invite.send_skipped_org_missing",
                extra={
                    "invite_id": str(invite.id),
                    "organization_id": str(invite.organization_id),
                },
            )
            return

        content, _accept_url = build_organization_invite_email(
            OrganizationInviteEmailRenderInput(
                organization_name=organization.name,
                invite_token=invite.token,
                invite_accept_base_url=settings.invite_accept_base_url,
            )
        )
        request = OrganizationInviteEmailSendRequest(
            invite_id=invite.id,
            organization_id=organization.id,
            invited_email=invite.invited_email,
            idempotency_key=_idempotency_key(
                invite_id=str(invite.id),
                send_key=payload.send_key,
            ),
            content=content,
        )

        logger.info(
            "email.invite.send_started",
            extra={
                "invite_id": str(invite.id),
                "organization_id": str(organization.id),
                "trigger": payload.trigger,
                "attempt": task.attempts,
            },
        )
        try:
            await sender.send_organization_invite_email(request)
        except InviteEmailDeliveryError as exc:
            logger.warning(
                "email.invite.send_failed",
                extra={
                    "invite_id": str(invite.id),
                    "organization_id": str(organization.id),
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
            "email.invite.send_succeeded",
            extra={
                "invite_id": str(invite.id),
                "organization_id": str(organization.id),
                "trigger": payload.trigger,
                "attempt": task.attempts,
            },
        )

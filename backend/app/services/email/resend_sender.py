"""Resend provider adapter for organization invite emails."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from app.core.logging import get_logger
from app.services.email.email_sender import (
    InviteEmailDeliveryError,
    InviteEmailSender,
    OrganizationInviteEmailSendRequest,
)

logger = get_logger(__name__)
_RETRYABLE_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


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
        self._send_email = resend.Emails.send

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


def _is_retryable_resend_error(exc: Exception) -> bool:
    if isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return True

    code_raw = getattr(exc, "status_code", None)
    if code_raw is None:
        code_raw = getattr(exc, "code", None)
    try:
        code = int(code_raw)
    except (TypeError, ValueError):
        return False
    return code in _RETRYABLE_CODES

"""Typed contracts for organization invite email delivery providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class OrganizationInviteEmailContent:
    """Rendered invite email content ready for provider submission."""

    subject: str
    text: str
    html: str


@dataclass(frozen=True)
class OrganizationInviteEmailSendRequest:
    """Provider-agnostic invite email send request."""

    invite_id: UUID
    organization_id: UUID
    invited_email: str
    idempotency_key: str
    content: OrganizationInviteEmailContent


class InviteEmailDeliveryError(RuntimeError):
    """Delivery failure with retryability hint for queue workers."""

    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class InviteEmailSender(Protocol):
    """Contract implemented by provider-specific invite email adapters."""

    async def send_organization_invite_email(
        self,
        request: OrganizationInviteEmailSendRequest,
    ) -> None:
        """Send one organization invite email."""

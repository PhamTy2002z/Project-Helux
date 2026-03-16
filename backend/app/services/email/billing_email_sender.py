"""Typed contracts for billing email delivery providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class BillingEmailContent:
    """Rendered billing email content ready for provider submission."""

    subject: str
    text: str
    html: str


@dataclass(frozen=True)
class BillingEmailSendRequest:
    """Provider-agnostic billing email send request."""

    organization_id: UUID
    recipient_email: str
    email_type: str  # "upgrade_confirmed" | "trial_expiring" | "payment_failed"
    idempotency_key: str
    content: BillingEmailContent


class BillingEmailDeliveryError(RuntimeError):
    """Delivery failure with retryability hint for queue workers."""

    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class BillingEmailSender(Protocol):
    """Contract implemented by provider-specific billing email adapters."""

    async def send_billing_email(
        self,
        request: BillingEmailSendRequest,
    ) -> None:
        """Send one billing email."""

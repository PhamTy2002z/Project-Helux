"""Typed contracts for welcome email delivery providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class WelcomeEmailContent:
    """Rendered welcome email content ready for provider submission."""

    subject: str
    text: str
    html: str


@dataclass(frozen=True)
class WelcomeEmailSendRequest:
    """Provider-agnostic welcome email send request."""

    user_email: str
    user_id: str
    idempotency_key: str
    content: WelcomeEmailContent


class WelcomeEmailDeliveryError(RuntimeError):
    """Delivery failure with retryability hint for queue workers."""

    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class WelcomeEmailSender(Protocol):
    """Contract implemented by provider-specific welcome email adapters."""

    async def send_welcome_email(
        self,
        request: WelcomeEmailSendRequest,
    ) -> None:
        """Send one welcome email."""

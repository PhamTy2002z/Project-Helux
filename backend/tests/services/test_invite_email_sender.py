# ruff: noqa: INP001
"""Invite email builder and Resend sender adapter tests."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.services.email.email_sender import (
    InviteEmailDeliveryError,
    OrganizationInviteEmailContent,
    OrganizationInviteEmailSendRequest,
)
from app.services.email.organization_invite_email import (
    OrganizationInviteEmailRenderInput,
    build_organization_invite_email,
)
from app.services.email.resend_sender import ResendInviteEmailSender


@pytest.mark.parametrize("org_name", ["Alpha Team", "<Team>&Partners"])
def test_build_organization_invite_email_renders_accept_url_and_text(org_name: str) -> None:
    content, accept_url = build_organization_invite_email(
        OrganizationInviteEmailRenderInput(
            organization_name=org_name,
            invite_token="token-123",
            invite_accept_base_url="http://localhost:3000/invite?utm=abc",
        )
    )

    assert accept_url == "http://localhost:3000/invite?utm=abc&token=token-123"
    assert "token-123" in content.text
    assert "Accept invite" in content.html


@pytest.mark.asyncio
async def test_resend_sender_maps_payload_and_idempotency_options() -> None:
    captured: dict[str, object] = {}

    def _fake_send(payload: dict[str, object], options: dict[str, str] | None) -> dict[str, str]:
        captured["payload"] = payload
        captured["options"] = options or {}
        return {"id": "email_123"}

    sender = ResendInviteEmailSender(
        api_key="re_test",
        sender="FlowGrid <noreply@example.com>",
        reply_to="support@example.com",
        send_email=_fake_send,
    )
    request = OrganizationInviteEmailSendRequest(
        invite_id=uuid4(),
        organization_id=uuid4(),
        invited_email="user@example.com",
        idempotency_key="idem-123",
        content=OrganizationInviteEmailContent(
            subject="Invite",
            text="Text",
            html="<p>HTML</p>",
        ),
    )

    await sender.send_organization_invite_email(request)

    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["from"] == "FlowGrid <noreply@example.com>"
    assert payload["to"] == ["user@example.com"]
    assert payload["reply_to"] == "support@example.com"
    assert captured["options"] == {"idempotency_key": "idem-123"}


@pytest.mark.asyncio
async def test_resend_sender_marks_retryable_errors() -> None:
    class _Err(Exception):
        def __init__(self) -> None:
            super().__init__("service unavailable")
            self.status_code = 503

    def _fake_send(_payload: dict[str, object], _options: dict[str, str] | None) -> None:
        raise _Err()

    sender = ResendInviteEmailSender(
        api_key="re_test",
        sender="FlowGrid <noreply@example.com>",
        reply_to=None,
        send_email=_fake_send,
    )
    request = OrganizationInviteEmailSendRequest(
        invite_id=uuid4(),
        organization_id=uuid4(),
        invited_email="user@example.com",
        idempotency_key="idem-123",
        content=OrganizationInviteEmailContent(subject="Invite", text="Text", html="<p>HTML</p>"),
    )

    with pytest.raises(InviteEmailDeliveryError) as exc_info:
        await sender.send_organization_invite_email(request)

    assert exc_info.value.retryable is True


@pytest.mark.asyncio
async def test_resend_sender_marks_non_retryable_errors() -> None:
    class _Err(Exception):
        def __init__(self) -> None:
            super().__init__("bad request")
            self.status_code = 400

    def _fake_send(_payload: dict[str, object], _options: dict[str, str] | None) -> None:
        raise _Err()

    sender = ResendInviteEmailSender(
        api_key="re_test",
        sender="FlowGrid <noreply@example.com>",
        reply_to=None,
        send_email=_fake_send,
    )
    request = OrganizationInviteEmailSendRequest(
        invite_id=uuid4(),
        organization_id=uuid4(),
        invited_email="user@example.com",
        idempotency_key="idem-123",
        content=OrganizationInviteEmailContent(subject="Invite", text="Text", html="<p>HTML</p>"),
    )

    with pytest.raises(InviteEmailDeliveryError) as exc_info:
        await sender.send_organization_invite_email(request)

    assert exc_info.value.retryable is False

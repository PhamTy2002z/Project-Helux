# ruff: noqa: INP001
"""Worker behavior tests for organization invite email tasks."""

from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.organization_invites import OrganizationInvite
from app.models.organizations import Organization
from app.services.email.email_sender import InviteEmailDeliveryError
from app.services.email.worker import process_invite_email_task
from app.services.queue import QueuedTask


@pytest.mark.asyncio
async def test_process_invite_email_task_sends_and_builds_idempotency_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)

    org_id = uuid4()
    invite_id = uuid4()
    async with session_maker() as session:
        session.add(Organization(id=org_id, name="Alpha"))
        session.add(
            OrganizationInvite(
                id=invite_id,
                organization_id=org_id,
                invited_email="invitee@example.com",
                token="token-abc",
                role="member",
            )
        )
        await session.commit()

    sent: list[object] = []

    class _FakeSender:
        async def send_organization_invite_email(self, request: object) -> None:
            sent.append(request)

    monkeypatch.setattr("app.services.email.worker.async_session_maker", session_maker)
    monkeypatch.setattr("app.services.email.worker.get_invite_email_sender", lambda: _FakeSender())
    monkeypatch.setattr(
        "app.services.email.worker.settings",
        type("_S", (), {"invite_accept_base_url": "http://localhost:3000/invite"})(),
    )

    task = QueuedTask(
        task_type="organization_invite_email_send",
        payload={"invite_id": str(invite_id), "send_key": "send-1", "trigger": "create"},
        created_at=datetime.now(UTC),
        attempts=0,
    )
    await process_invite_email_task(task)

    assert len(sent) == 1
    request = sent[0]
    assert getattr(request, "invited_email") == "invitee@example.com"
    expected_key = sha256(f"organization-invite:{invite_id}:send-1".encode("utf-8")).hexdigest()
    assert getattr(request, "idempotency_key") == expected_key

    await engine.dispose()


@pytest.mark.asyncio
async def test_process_invite_email_task_retries_on_retryable_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invite = OrganizationInvite(
        id=uuid4(),
        organization_id=uuid4(),
        invited_email="invitee@example.com",
        token="token-abc",
        role="member",
    )
    org = Organization(id=invite.organization_id, name="Alpha")

    class _Objects:
        def __init__(self, value: object) -> None:
            self._value = value

        def by_id(self, _id: object) -> _Objects:
            return self

        async def first(self, _session: object) -> object:
            return self._value

    class _FakeSessionCtx:
        async def __aenter__(self) -> object:
            return object()

        async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
            del exc_type, exc, tb

    class _Sender:
        async def send_organization_invite_email(self, request: object) -> None:
            del request
            raise InviteEmailDeliveryError("upstream timeout", retryable=True)

    monkeypatch.setattr(
        "app.services.email.worker.OrganizationInvite", type("I", (), {"objects": _Objects(invite)})
    )
    monkeypatch.setattr(
        "app.services.email.worker.Organization", type("O", (), {"objects": _Objects(org)})
    )
    monkeypatch.setattr("app.services.email.worker.async_session_maker", lambda: _FakeSessionCtx())
    monkeypatch.setattr("app.services.email.worker.get_invite_email_sender", lambda: _Sender())
    monkeypatch.setattr(
        "app.services.email.worker.settings",
        type("_S", (), {"invite_accept_base_url": "http://localhost:3000/invite"})(),
    )

    task = QueuedTask(
        task_type="organization_invite_email_send",
        payload={"invite_id": str(invite.id), "send_key": "send-1", "trigger": "resend"},
        created_at=datetime.now(UTC),
    )

    with pytest.raises(RuntimeError, match="upstream timeout"):
        await process_invite_email_task(task)

# ruff: noqa: INP001
"""Organization invite API tests for async invite-email queue integration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api import organizations
from app.models.organization_invites import OrganizationInvite
from app.models.organization_members import OrganizationMember
from app.models.organizations import Organization
from app.schemas.organizations import OrganizationInviteCreate
from app.services.organizations import OrganizationContext


@dataclass
class _FakeExecResult:
    first_value: Any = None

    def first(self) -> Any:
        return self.first_value


@dataclass
class _FakeSession:
    exec_results: list[Any]
    committed: int = 0
    flushed: int = 0
    refreshed: list[object] | None = None
    added: list[object] | None = None

    def __post_init__(self) -> None:
        self.refreshed = []
        self.added = []

    async def exec(self, _statement: object) -> Any:
        if not self.exec_results:
            raise AssertionError("No more exec results")
        return self.exec_results.pop(0)

    def add(self, value: object) -> None:
        assert self.added is not None
        self.added.append(value)

    async def flush(self) -> None:
        self.flushed += 1

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, value: object) -> None:
        assert self.refreshed is not None
        self.refreshed.append(value)


def _ctx() -> OrganizationContext:
    org_id = uuid4()
    return OrganizationContext(
        organization=Organization(id=org_id, name="Alpha"),
        member=OrganizationMember(organization_id=org_id, user_id=uuid4(), role="admin"),
    )


@pytest.mark.asyncio
async def test_create_org_invite_enqueues_email(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession(exec_results=[_FakeExecResult(first_value=None)])
    captured: dict[str, object] = {}

    async def _noop_apply(*_args: object, **_kwargs: object) -> None:
        return None

    monkeypatch.setattr(organizations, "apply_invite_board_access", _noop_apply)
    monkeypatch.setattr(organizations, "record_admin_audit", lambda *args, **kwargs: None)
    monkeypatch.setattr(organizations, "_enqueue_invite_email_send", lambda **kwargs: captured.update(kwargs))
    monkeypatch.setattr(organizations.secrets, "token_urlsafe", lambda _n: "invite-token")

    payload = OrganizationInviteCreate(
        invited_email="  Invitee@Example.com ",
        role="member",
        all_boards_read=False,
        all_boards_write=False,
        board_access=[],
    )
    response = await organizations.create_org_invite(payload=payload, session=session, ctx=_ctx())

    assert response.invited_email == "invitee@example.com"
    assert response.token == "invite-token"
    assert captured["trigger"] == "create"
    assert str(captured["invite_id"]) == str(response.id)


@pytest.mark.asyncio
async def test_resend_org_invite_enqueues_email(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession(exec_results=[])
    invite = OrganizationInvite(
        id=uuid4(),
        organization_id=_ctx().organization.id,
        invited_email="invitee@example.com",
        token="token-1",
        role="member",
    )
    captured: dict[str, object] = {}

    async def _fake_require(*_args: object, **_kwargs: object) -> OrganizationInvite:
        return invite

    monkeypatch.setattr(organizations, "_require_org_invite", _fake_require)
    monkeypatch.setattr(organizations, "_enqueue_invite_email_send", lambda **kwargs: captured.update(kwargs))
    monkeypatch.setattr(organizations, "record_admin_audit", lambda *args, **kwargs: None)

    response = await organizations.resend_org_invite(
        invite_id=invite.id,
        session=session,
        ctx=OrganizationContext(
            organization=Organization(id=invite.organization_id, name="Alpha"),
            member=OrganizationMember(organization_id=invite.organization_id, user_id=uuid4(), role="admin"),
        ),
    )

    assert response.id == invite.id
    assert captured == {"invite_id": invite.id, "trigger": "resend"}
    assert session.committed == 1


@pytest.mark.asyncio
async def test_resend_org_invite_rejects_accepted_invite(monkeypatch: pytest.MonkeyPatch) -> None:
    accepted_invite = OrganizationInvite(
        id=uuid4(),
        organization_id=uuid4(),
        invited_email="invitee@example.com",
        token="token-1",
        role="member",
        accepted_at=datetime.now(),
    )

    async def _fake_require(*_args: object, **_kwargs: object) -> OrganizationInvite:
        return accepted_invite

    monkeypatch.setattr(organizations, "_require_org_invite", _fake_require)

    with pytest.raises(HTTPException) as exc_info:
        await organizations.resend_org_invite(
            invite_id=accepted_invite.id,
            session=_FakeSession(exec_results=[]),
            ctx=OrganizationContext(
                organization=Organization(id=accepted_invite.organization_id, name="Alpha"),
                member=OrganizationMember(
                    organization_id=accepted_invite.organization_id,
                    user_id=uuid4(),
                    role="admin",
                ),
            ),
        )

    assert exc_info.value.status_code == 422

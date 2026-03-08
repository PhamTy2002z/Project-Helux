"""Utilities for recording normalized activity events."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from uuid import UUID

    from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.activity_events import ActivityEvent

ADMIN_AUDIT_EVENT_BY_ACTION: dict[str, str] = {
    "organization.plan.assign": "admin.organization.plan_assigned",
    "billing.simulate.checkout": "admin.billing.simulated_checkout",
    "organization.member.update": "admin.organization.member_updated",
    "organization.member.access.update": "admin.organization.member_access_updated",
    "organization.member.remove": "admin.organization.member_removed",
    "organization.invite.create": "admin.organization.invite_created",
    "organization.invite.revoke": "admin.organization.invite_revoked",
    "organization.delete": "admin.organization.deleted",
    "gateway.create": "admin.gateway.created",
    "gateway.update": "admin.gateway.updated",
    "gateway.templates.sync": "admin.gateway.templates_synced",
    "gateway.delete": "admin.gateway.deleted",
    "gateway.session.message": "admin.gateway.session_message_sent",
}


def record_activity(
    session: AsyncSession,
    *,
    event_type: str,
    message: str,
    agent_id: UUID | None = None,
    task_id: UUID | None = None,
    board_id: UUID | None = None,
    organization_id: UUID | None = None,
) -> ActivityEvent:
    """Create and attach an activity event row to the current DB session."""
    event = ActivityEvent(
        event_type=event_type,
        message=message,
        agent_id=agent_id,
        task_id=task_id,
        board_id=board_id,
        organization_id=organization_id,
    )
    session.add(event)
    return event


def record_admin_audit(
    session: AsyncSession,
    *,
    audit_action: str,
    endpoint: str,
    organization_id: UUID | None,
    actor_id: UUID | None,
    target_id: UUID | None = None,
    details: dict[str, object] | None = None,
) -> ActivityEvent:
    """Record a structured admin mutation audit event."""
    event_type = ADMIN_AUDIT_EVENT_BY_ACTION.get(audit_action)
    if event_type is None:
        raise ValueError(f"Unknown audit action: {audit_action}")

    payload: dict[str, object] = {
        "audit_action": audit_action,
        "endpoint": endpoint,
    }
    if organization_id is not None:
        payload["organization_id"] = str(organization_id)
    if actor_id is not None:
        payload["actor_id"] = str(actor_id)
    if target_id is not None:
        payload["target_id"] = str(target_id)
    if details:
        payload["details"] = details

    return record_activity(
        session,
        event_type=event_type,
        message=json.dumps(payload, separators=(",", ":"), sort_keys=True),
        organization_id=organization_id,
    )

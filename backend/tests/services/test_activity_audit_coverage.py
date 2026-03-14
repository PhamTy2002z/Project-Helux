from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from app.services.activity_log import ADMIN_AUDIT_EVENT_BY_ACTION, record_admin_audit

EXPECTED_AUDIT_ACTIONS = {
    "organization.plan.assign",
    "billing.simulate.checkout",
    "organization.member.update",
    "organization.member.access.update",
    "organization.member.remove",
    "organization.invite.create",
    "organization.invite.resend",
    "organization.invite.revoke",
    "organization.delete",
    "gateway.create",
    "gateway.update",
    "gateway.templates.sync",
    "gateway.delete",
    "gateway.session.message",
}


def test_admin_audit_catalog_matches_expected_sensitive_actions() -> None:
    assert set(ADMIN_AUDIT_EVENT_BY_ACTION) == EXPECTED_AUDIT_ACTIONS
    assert all(
        event_type.startswith("admin.") for event_type in ADMIN_AUDIT_EVENT_BY_ACTION.values()
    )


def test_admin_audit_actions_are_used_in_mutation_routes() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    source = "\n".join(
        [
            (backend_root / "app/api/organizations.py").read_text(encoding="utf-8"),
            (backend_root / "app/api/billing.py").read_text(encoding="utf-8"),
            (backend_root / "app/api/gateway.py").read_text(encoding="utf-8"),
            (backend_root / "app/api/gateways.py").read_text(encoding="utf-8"),
        ],
    )

    for action in EXPECTED_AUDIT_ACTIONS:
        assert f'audit_action="{action}"' in source


def test_record_admin_audit_serializes_structured_payload() -> None:
    captured: list[object] = []

    class _Session:
        def add(self, value: object) -> None:
            captured.append(value)

    org_id = uuid4()
    actor_id = uuid4()
    target_id = uuid4()

    event = record_admin_audit(
        _Session(),
        audit_action="gateway.update",
        endpoint="/api/v1/gateways/{gateway_id}",
        organization_id=org_id,
        actor_id=actor_id,
        target_id=target_id,
        details={"updated_fields": ["url"]},
    )

    payload = json.loads(event.message or "{}")
    assert event.event_type == "admin.gateway.updated"
    assert payload["audit_action"] == "gateway.update"
    assert payload["organization_id"] == str(org_id)
    assert payload["actor_id"] == str(actor_id)
    assert payload["target_id"] == str(target_id)
    assert payload["endpoint"] == "/api/v1/gateways/{gateway_id}"
    assert payload["details"] == {"updated_fields": ["url"]}
    assert captured and captured[0] is event

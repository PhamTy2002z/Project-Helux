# Audit catalog

This catalog maps admin-sensitive mutation endpoints to required `event_type`
values in `activity_events`.

## Organization mutations

| Endpoint | Method | Event type |
|---|---|---|
| `/api/v1/organizations/me/plan` | `PATCH` | `admin.organization.plan_assigned` |
| `/api/v1/organizations/me/members/{member_id}` | `PATCH` | `admin.organization.member_updated` |
| `/api/v1/organizations/me/members/{member_id}/access` | `PUT` | `admin.organization.member_access_updated` |
| `/api/v1/organizations/me/members/{member_id}` | `DELETE` | `admin.organization.member_removed` |
| `/api/v1/organizations/me/invites` | `POST` | `admin.organization.invite_created` |
| `/api/v1/organizations/me/invites/{invite_id}` | `DELETE` | `admin.organization.invite_revoked` |
| `/api/v1/organizations/me` | `DELETE` | `admin.organization.deleted` |

## Gateway mutations

| Endpoint | Method | Event type |
|---|---|---|
| `/api/v1/gateways` | `POST` | `admin.gateway.created` |
| `/api/v1/gateways/{gateway_id}` | `PATCH` | `admin.gateway.updated` |
| `/api/v1/gateways/{gateway_id}/templates/sync` | `POST` | `admin.gateway.templates_synced` |
| `/api/v1/gateways/{gateway_id}` | `DELETE` | `admin.gateway.deleted` |
| `/api/v1/gateways/sessions/{session_id}/message` | `POST` | `admin.gateway.session_message_sent` |

## Event payload format

`message` stores structured JSON with these keys:

- `audit_action`
- `endpoint`
- `organization_id` (when available)
- `actor_id` (when available)
- `target_id` (when available)
- `details` (operation-specific metadata)

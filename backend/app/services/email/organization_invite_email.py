"""Organization invite email message builder."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.services.email.email_sender import OrganizationInviteEmailContent


@dataclass(frozen=True)
class OrganizationInviteEmailRenderInput:
    """Inputs used to render organization invite email content."""

    organization_name: str
    invite_token: str
    invite_accept_base_url: str


def _build_invite_accept_url(*, base_url: str, token: str) -> str:
    parsed = urlparse(base_url)
    query_items = parse_qsl(parsed.query, keep_blank_values=True)
    query = [(key, value) for key, value in query_items if key != "token"]
    query.append(("token", token))
    return urlunparse(parsed._replace(query=urlencode(query)))


def _display_org_name(name: str) -> str:
    normalized = name.strip()
    return normalized or "your organization"


def build_organization_invite_email(
    payload: OrganizationInviteEmailRenderInput,
) -> tuple[OrganizationInviteEmailContent, str]:
    """Return invite email content and accept URL."""
    org_name = _display_org_name(payload.organization_name)
    accept_url = _build_invite_accept_url(
        base_url=payload.invite_accept_base_url,
        token=payload.invite_token,
    )
    escaped_org_name = escape(org_name)
    escaped_accept_url = escape(accept_url, quote=True)

    subject = f"You're invited to join {org_name} on FlowGrid"
    text = (
        f"You have been invited to join {org_name} on FlowGrid.\n\n"
        f"Accept invite: {accept_url}\n\n"
        "If the button does not work, copy and paste the URL into your browser."
    )
    html = (
        "<html><body style=\"font-family:Arial,sans-serif;line-height:1.5;\">"
        f"<p>You have been invited to join <strong>{escaped_org_name}</strong> on FlowGrid.</p>"
        f"<p><a href=\"{escaped_accept_url}\" "
        "style=\"display:inline-block;padding:10px 16px;background:#0f172a;color:#ffffff;"
        "text-decoration:none;border-radius:8px;\">Accept invite</a></p>"
        f"<p>If the button does not work, use this URL:<br><a href=\"{escaped_accept_url}\">"
        f"{escaped_accept_url}</a></p>"
        "</body></html>"
    )
    return (
        OrganizationInviteEmailContent(
            subject=subject,
            text=text,
            html=html,
        ),
        accept_url,
    )

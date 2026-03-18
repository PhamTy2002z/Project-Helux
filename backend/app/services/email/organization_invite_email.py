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

    subject = f"You're invited to join {org_name} on VisgniteAI"
    text = (
        f"You have been invited to join {org_name} on VisgniteAI.\n\n"
        f"Accept invite: {accept_url}\n\n"
        "If the button does not work, copy and paste the URL into your browser."
    )
    html = (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "</head>"
        '<body style="margin:0;padding:0;background-color:#f8fafc;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
        "'Helvetica Neue',Arial,sans-serif;\">"
        # Outer wrapper
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#f8fafc;padding:40px 0;">'
        '<tr><td align="center">'
        # Inner card
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background-color:#ffffff;border-radius:16px;'
        'border:1px solid #e2e8f0;overflow:hidden;">'
        # Header bar
        '<tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);'
        "padding:32px 40px;'>"
        '<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;'
        'text-transform:uppercase;color:#94a3b8;">VisgniteAI</p>'
        '<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">'
        "You're invited to collaborate</p>"
        "</td></tr>"
        # Body
        '<tr><td style="padding:32px 40px;">'
        f'<p style="margin:0 0 6px;font-size:15px;color:#475569;">Hi there,</p>'
        f'<p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">'
        f'You\'ve been invited to join <strong style="color:#0f172a;">'
        f"{escaped_org_name}</strong> on VisgniteAI. Click the button below to "
        "accept and get started.</p>"
        # CTA button
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:0 0 24px;">'
        '<tr><td style="background-color:#0f172a;border-radius:10px;">'
        f'<a href="{escaped_accept_url}" target="_blank" '
        'style="display:inline-block;padding:12px 28px;font-size:14px;'
        'font-weight:600;color:#ffffff;text-decoration:none;">'
        "Accept Invite</a>"
        "</td></tr></table>"
        # Divider
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">'
        # Fallback URL
        '<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">'
        "If the button doesn't work, copy this link:</p>"
        f'<p style="margin:0;font-size:12px;word-break:break-all;">'
        f'<a href="{escaped_accept_url}" style="color:#3b82f6;text-decoration:none;">'
        f"{escaped_accept_url}</a></p>"
        "</td></tr>"
        # Footer
        '<tr><td style="padding:20px 40px;background-color:#f8fafc;'
        'border-top:1px solid #e2e8f0;">'
        '<p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">'
        "This invite was sent by VisgniteAI. If you didn't expect this, "
        "you can safely ignore it.</p>"
        "</td></tr>"
        "</table>"
        "</td></tr></table>"
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

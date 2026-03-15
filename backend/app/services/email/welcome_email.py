"""Welcome email message builder."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape

from app.services.email.welcome_email_sender import WelcomeEmailContent


@dataclass(frozen=True)
class WelcomeEmailRenderInput:
    """Inputs used to render welcome email content."""

    first_name: str
    dashboard_url: str


def _display_name(name: str) -> str:
    # Strip whitespace and remove CR/LF to prevent email header injection
    normalized = name.strip().replace("\r", "").replace("\n", "")
    return normalized or "there"


def build_welcome_email(
    payload: WelcomeEmailRenderInput,
) -> WelcomeEmailContent:
    """Return welcome email content for a new user."""
    name = _display_name(payload.first_name)
    escaped_name = escape(name)
    escaped_dashboard_url = escape(payload.dashboard_url, quote=True)

    subject = f"Welcome to FlowGrid, {name}!"
    text = (
        f"Hi {name},\n\n"
        "Welcome to FlowGrid! We're glad you're here.\n\n"
        "FlowGrid helps you orchestrate AI agents, manage boards, "
        "and keep your team aligned — all in one place.\n\n"
        "Ready to get started? Head over to your dashboard:\n"
        f"{payload.dashboard_url}\n\n"
        "If you have any questions, just reply to this email. "
        "We're happy to help.\n\n"
        "— The FlowGrid Team"
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
        'padding:32px 40px;">'
        '<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;'
        'text-transform:uppercase;color:#94a3b8;">FlowGrid</p>'
        '<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">'
        "Welcome aboard</p>"
        "</td></tr>"
        # Body
        '<tr><td style="padding:32px 40px;">'
        f'<p style="margin:0 0 6px;font-size:15px;color:#475569;">'
        f"Hi {escaped_name},</p>"
        '<p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">'
        "Thanks for joining FlowGrid! We built this platform to help teams "
        "orchestrate AI agents, manage work, and stay in sync "
        "&mdash; and we're excited to have you on board.</p>"
        '<p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">'
        "Your dashboard is ready. From there you can create your first board, "
        "invite teammates, and start putting your agents to work.</p>"
        # CTA button
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="margin:0 0 24px;">'
        '<tr><td style="background-color:#0f172a;border-radius:10px;">'
        f'<a href="{escaped_dashboard_url}" target="_blank" '
        'style="display:inline-block;padding:12px 28px;font-size:14px;'
        'font-weight:600;color:#ffffff;text-decoration:none;">'
        "Go to Dashboard</a>"
        "</td></tr></table>"
        # Divider
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">'
        # Fallback URL
        '<p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">'
        "If the button doesn't work, copy this link:</p>"
        f'<p style="margin:0;font-size:12px;word-break:break-all;">'
        f'<a href="{escaped_dashboard_url}" style="color:#3b82f6;text-decoration:none;">'
        f"{escaped_dashboard_url}</a></p>"
        "</td></tr>"
        # Footer
        '<tr><td style="padding:20px 40px;background-color:#f8fafc;'
        'border-top:1px solid #e2e8f0;">'
        '<p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">'
        "You received this because you signed up for FlowGrid. "
        "If this wasn't you, you can safely ignore this email.</p>"
        "</td></tr>"
        "</table>"
        "</td></tr></table>"
        "</body></html>"
    )
    return WelcomeEmailContent(subject=subject, text=text, html=html)

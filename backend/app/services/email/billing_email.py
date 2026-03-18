"""Billing email message builders."""

from __future__ import annotations

from html import escape

from app.services.email.billing_email_sender import BillingEmailContent


def build_upgrade_confirmed_email(*, org_name: str, dashboard_url: str) -> BillingEmailContent:
    """Build upgrade confirmation email content."""
    escaped_name = escape(org_name)
    escaped_url = escape(dashboard_url, quote=True)

    subject = "Welcome to VisgniteAI Pro!"
    text = (
        f"Hi {org_name},\n\n"
        "Your upgrade to VisgniteAI Pro is confirmed!\n\n"
        "What's unlocked:\n"
        "- 2 board groups, 3 boards\n"
        "- 15 agents, 5 per board\n"
        "- 200M tokens/month, 16k max tokens/run\n\n"
        f"Head to your dashboard: {dashboard_url}\n\n"
        "— The VisgniteAI Team"
    )
    html = (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "</head>"
        '<body style="margin:0;padding:0;background-color:#f8fafc;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
        "'Helvetica Neue',Arial,sans-serif;\">"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#f8fafc;padding:40px 0;">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background-color:#ffffff;border-radius:16px;'
        'border:1px solid #e2e8f0;overflow:hidden;">'
        '<tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);'
        'padding:32px 40px;">'
        '<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;'
        'text-transform:uppercase;color:rgba(255,255,255,0.7);">VisgniteAI</p>'
        '<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">'
        "Welcome to Pro!</p>"
        "</td></tr>"
        '<tr><td style="padding:32px 40px;">'
        f'<p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi {escaped_name},</p>'
        '<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">'
        "Your upgrade to VisgniteAI Pro is confirmed. Here's what you've unlocked:</p>"
        '<ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">'
        "<li>2 board groups, 3 boards</li>"
        "<li>15 agents total, 5 per board</li>"
        "<li>200M org tokens/month</li>"
        "<li>16k max tokens per run</li>"
        "</ul>"
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">'
        '<tr><td style="background-color:#059669;border-radius:10px;">'
        f'<a href="{escaped_url}" target="_blank" '
        'style="display:inline-block;padding:12px 28px;font-size:14px;'
        'font-weight:600;color:#ffffff;text-decoration:none;">'
        "Go to Dashboard</a>"
        "</td></tr></table>"
        "</td></tr>"
        '<tr><td style="padding:20px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">'
        '<p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">'
        "You received this because your organization upgraded to VisgniteAI Pro.</p>"
        "</td></tr>"
        "</table></td></tr></table></body></html>"
    )
    return BillingEmailContent(subject=subject, text=text, html=html)


def build_trial_expiring_email(
    *, org_name: str, days_remaining: int, upgrade_url: str
) -> BillingEmailContent:
    """Build trial expiring warning email content."""
    escaped_name = escape(org_name)
    escaped_url = escape(upgrade_url, quote=True)
    day_word = "day" if days_remaining == 1 else "days"

    subject = f"Your VisgniteAI trial expires in {days_remaining} {day_word}"
    text = (
        f"Hi {org_name},\n\n"
        f"Your VisgniteAI trial expires in {days_remaining} {day_word}.\n\n"
        "When the trial ends, runtime actions will be blocked.\n"
        "Upgrade now to keep your boards running.\n\n"
        f"Upgrade: {upgrade_url}\n\n"
        "— The VisgniteAI Team"
    )
    html = (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "</head>"
        '<body style="margin:0;padding:0;background-color:#f8fafc;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
        "'Helvetica Neue',Arial,sans-serif;\">"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#f8fafc;padding:40px 0;">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background-color:#ffffff;border-radius:16px;'
        'border:1px solid #e2e8f0;overflow:hidden;">'
        '<tr><td style="background:linear-gradient(135deg,#d97706 0%,#f59e0b 100%);'
        'padding:32px 40px;">'
        '<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;'
        'text-transform:uppercase;color:rgba(255,255,255,0.7);">VisgniteAI</p>'
        f'<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">'
        f"Trial expires in {days_remaining} {day_word}</p>"
        "</td></tr>"
        '<tr><td style="padding:32px 40px;">'
        f'<p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi {escaped_name},</p>'
        '<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">'
        f"Your VisgniteAI trial expires in <strong>{days_remaining} {day_word}</strong>. "
        "When it ends, runtime actions (agent runs, task creation) will be blocked.</p>"
        '<p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">'
        "Upgrade to Pro to keep everything running smoothly.</p>"
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">'
        '<tr><td style="background-color:#d97706;border-radius:10px;">'
        f'<a href="{escaped_url}" target="_blank" '
        'style="display:inline-block;padding:12px 28px;font-size:14px;'
        'font-weight:600;color:#ffffff;text-decoration:none;">'
        "Upgrade to Pro</a>"
        "</td></tr></table>"
        "</td></tr>"
        '<tr><td style="padding:20px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">'
        '<p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">'
        "You received this because your VisgniteAI trial is expiring.</p>"
        "</td></tr>"
        "</table></td></tr></table></body></html>"
    )
    return BillingEmailContent(subject=subject, text=text, html=html)


def build_payment_failed_email(*, org_name: str, portal_url: str) -> BillingEmailContent:
    """Build payment failed notification email content."""
    escaped_name = escape(org_name)
    escaped_url = escape(portal_url, quote=True)

    subject = "Action required: Payment issue on VisgniteAI"
    text = (
        f"Hi {org_name},\n\n"
        "We had trouble processing your VisgniteAI payment.\n\n"
        "Please update your payment method to continue using Pro features.\n\n"
        f"Manage billing: {portal_url}\n\n"
        "— The VisgniteAI Team"
    )
    html = (
        "<!DOCTYPE html>"
        '<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "</head>"
        '<body style="margin:0;padding:0;background-color:#f8fafc;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,"
        "'Helvetica Neue',Arial,sans-serif;\">"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background-color:#f8fafc;padding:40px 0;">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background-color:#ffffff;border-radius:16px;'
        'border:1px solid #e2e8f0;overflow:hidden;">'
        '<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);'
        'padding:32px 40px;">'
        '<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.5px;'
        'text-transform:uppercase;color:rgba(255,255,255,0.7);">VisgniteAI</p>'
        '<p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">'
        "Payment issue</p>"
        "</td></tr>"
        '<tr><td style="padding:32px 40px;">'
        f'<p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi {escaped_name},</p>'
        '<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">'
        "We had trouble processing your payment for VisgniteAI Pro. "
        "Please update your payment method to avoid service interruption.</p>"
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">'
        '<tr><td style="background-color:#dc2626;border-radius:10px;">'
        f'<a href="{escaped_url}" target="_blank" '
        'style="display:inline-block;padding:12px 28px;font-size:14px;'
        'font-weight:600;color:#ffffff;text-decoration:none;">'
        "Update Payment Method</a>"
        "</td></tr></table>"
        "</td></tr>"
        '<tr><td style="padding:20px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">'
        '<p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">'
        "You received this because there's a payment issue with your VisgniteAI account.</p>"
        "</td></tr>"
        "</table></td></tr></table></body></html>"
    )
    return BillingEmailContent(subject=subject, text=text, html=html)

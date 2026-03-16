# Phase 06 -- Billing Emails via Resend

## Context Links
- Plan: `plan.md`
- Email worker pattern: `backend/app/services/email/worker.py`
- Resend sender: `backend/app/services/email/resend_sender.py`
- Webhook service: `backend/app/services/billing_webhook_service.py`
- Queue system: `backend/app/services/email/queue.py`
- Welcome email pattern: `backend/app/services/email/welcome_email.py`

## Overview
- **Priority:** P1
- **Status:** done
- **Depends on:** Phase 7 (backend work ensures webhook flow is solid)
- **Description:** Add billing transactional emails: upgrade confirmation, trial expiring (3 days before), payment failed.

## Key Insights
- Existing email pattern: Jinja2 template -> content builder -> sender adapter -> RQ worker
- `ResendInviteEmailSender` and `ResendWelcomeEmailSender` share `_ResendBase` with `_send_via_resend`
- Need a new `ResendBillingEmailSender` extending `_ResendBase`
- Webhook service already handles `subscription.active`, `subscription.revoked` events
- Trial expiry email needs a scheduled check (not event-driven) -- use RQ scheduled job or cron

### Email Templates Needed
1. **Upgrade confirmation** -- triggered by `subscription.active` webhook
2. **Trial expiring** -- triggered by scheduled check (3 days before `effective_until`)
3. **Payment failed** -- triggered by Polar `subscription.revoked` or future `charge.failed` event

## Requirements
### Functional
- **Upgrade confirmation:**
  - Trigger: `subscription.active` webhook event
  - Content: "Welcome to Pro!", plan summary, link to dashboard
  - Sent to org admin email
- **Trial expiring:**
  - Trigger: scheduled job checks orgs with trial expiring in <=3 days
  - Content: "Your trial expires in X days", upgrade CTA
  - Sent to org admin email
  - Idempotent: don't re-send if already sent for this trial period
- **Payment failed:**
  - Trigger: `subscription.revoked` webhook event
  - Content: "Payment issue", link to update payment method (Polar portal)
  - Sent to org admin email

### Non-Functional
- All emails async via RQ queue (non-blocking)
- Deterministic idempotency keys (prevent duplicate sends)
- Graceful degradation: email failure doesn't block webhook processing

## Architecture

```
Webhook/Scheduler
  |
  +-- subscription.active --> enqueue billing_email_send(type=upgrade_confirmed)
  |
  +-- subscription.revoked --> enqueue billing_email_send(type=payment_failed)
  |
  +-- scheduled_check (daily) --> find trials expiring in 3 days
                                  --> enqueue billing_email_send(type=trial_expiring)

RQ Worker
  |
  +-- process_billing_email_task(task)
       |
       +-- build_billing_email(type, context) --> EmailContent (subject, html, text)
       +-- ResendBillingEmailSender.send_billing_email(request)
```

## Related Code Files

| File | Action |
|------|--------|
| `backend/app/services/email/billing_email.py` | CREATE -- email content builder (Jinja2 templates) |
| `backend/app/services/email/billing_email_sender.py` | CREATE -- sender interface |
| `backend/app/services/email/billing_email_worker.py` | CREATE -- RQ worker handler |
| `backend/app/services/email/resend_sender.py` | MODIFY -- add ResendBillingEmailSender class |
| `backend/app/services/email/queue.py` | MODIFY -- add billing email queue helpers |
| `backend/app/services/billing_webhook_service.py` | MODIFY -- enqueue emails on subscription events |
| `backend/app/services/billing_trial_expiry_check.py` | CREATE -- scheduled job for trial expiry emails |

## Implementation Steps

### 1. Create billing email sender interface
`backend/app/services/email/billing_email_sender.py`:

```python
"""Interface for billing email delivery."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

@dataclass(frozen=True)
class BillingEmailContent:
    subject: str
    html: str
    text: str

@dataclass(frozen=True)
class BillingEmailSendRequest:
    organization_id: UUID
    recipient_email: str
    email_type: str  # "upgrade_confirmed" | "trial_expiring" | "payment_failed"
    idempotency_key: str
    content: BillingEmailContent

class BillingEmailDeliveryError(Exception):
    def __init__(self, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable

class BillingEmailSender(Protocol):
    async def send_billing_email(self, request: BillingEmailSendRequest) -> None: ...
```

### 2. Create email content builder
`backend/app/services/email/billing_email.py`:

Build HTML/text templates inline (Jinja2 strings, no separate template files needed for 3 simple emails):

```python
def build_upgrade_confirmed_email(*, org_name: str, dashboard_url: str) -> BillingEmailContent:
    # Subject: "Welcome to FlowGrid Pro!"
    # Body: congratulations, plan features, dashboard link

def build_trial_expiring_email(*, org_name: str, days_remaining: int, upgrade_url: str) -> BillingEmailContent:
    # Subject: "Your FlowGrid trial expires in {days} days"
    # Body: urgency message, what they'll lose, upgrade CTA

def build_payment_failed_email(*, org_name: str, portal_url: str) -> BillingEmailContent:
    # Subject: "Action required: Payment issue on FlowGrid"
    # Body: payment failed, update payment method via portal link
```

### 3. Add ResendBillingEmailSender to resend_sender.py

```python
class ResendBillingEmailSender(_ResendBase, BillingEmailSender):
    async def send_billing_email(self, request: BillingEmailSendRequest) -> None:
        try:
            await self._send_via_resend(
                to=request.recipient_email,
                subject=request.content.subject,
                html=request.content.html,
                text=request.content.text,
                idempotency_key=request.idempotency_key,
            )
        except Exception as exc:
            retryable = _is_retryable_resend_error(exc)
            raise BillingEmailDeliveryError(str(exc), retryable=retryable) from exc
```

### 4. Create billing email worker
`backend/app/services/email/billing_email_worker.py`:
- Follow pattern from `worker.py` (invite email worker)
- Decode task payload, load org + admin email, build content, send
- Idempotency key: `sha256(f"billing:{email_type}:{org_id}:{event_id}")`

### 5. Add queue helpers
In `backend/app/services/email/queue.py`, add:
- `encode_billing_email_task(...)` -- serialize billing email job payload
- `decode_billing_email_task(task)` -- deserialize

### 6. Hook into webhook service
In `billing_webhook_service.py`, after `_handle_subscription_active`:
```python
# After plan update, enqueue upgrade confirmation email
from app.services.email.queue import enqueue_billing_email
enqueue_billing_email(
    organization_id=organization_id,
    email_type="upgrade_confirmed",
    event_id=_safe_get(event_data, "id"),
)
```

Similarly for `_handle_subscription_revoked` -> enqueue `payment_failed` email.

### 7. Create trial expiry check job
`backend/app/services/billing_trial_expiry_check.py`:
- Query `organization_plans` where `tier = 'trial_7d'` and `effective_until` between now and now+3 days
- For each, check if email already sent (use `plan_metadata.billing.trial_expiry_email_sent`)
- If not sent, enqueue `trial_expiring` email and mark metadata

This job should be registered as a periodic RQ task or called via a management command.

## Todo List
- [ ] Create `billing_email_sender.py` (interface + data classes)
- [ ] Create `billing_email.py` (3 email content builders)
- [ ] Add `ResendBillingEmailSender` to `resend_sender.py`
- [ ] Create `billing_email_worker.py` (RQ worker handler)
- [ ] Add billing email queue helpers to `queue.py`
- [ ] Hook upgrade confirmation into `_handle_subscription_active`
- [ ] Hook payment failed into `_handle_subscription_revoked`
- [ ] Create `billing_trial_expiry_check.py` scheduled job
- [ ] Register trial expiry check as periodic task
- [ ] Test: upgrade email sent on subscription.active webhook
- [ ] Test: payment failed email sent on subscription.revoked webhook
- [ ] Test: trial expiry email sent 3 days before expiration
- [ ] Test: idempotency prevents duplicate emails
- [ ] Test: email failure doesn't block webhook processing

## Success Criteria
- Upgrade confirmation email sent within seconds of successful payment
- Trial expiring email sent exactly once, 3 days before expiration
- Payment failed email sent on subscription revocation
- All emails async, non-blocking, with retry for transient failures

## Risk Assessment
- **Email deliverability:** Resend handles SPF/DKIM. Verify domain is configured.
- **Webhook timing:** Email enqueued in webhook handler; if worker is down, email queued for later.
- **Trial expiry check missing:** If scheduled job doesn't run, emails won't send. Add monitoring.
- **Org admin email resolution:** Need to query org members for admin role to get email. Add helper.

## Security Considerations
- Emails contain no sensitive payment data
- Portal URLs in payment-failed emails are time-limited (Polar generates them)
- Idempotency keys prevent re-sending on webhook retries

## Next Steps
- Verify Resend domain is configured for billing emails
- Consider adding email preference/opt-out (P2)

## Phase 1: Welcome Email Template + Shared Sender

**Priority:** P1 | **Status:** Complete | **Effort:** 1h

### Overview

Create welcome email HTML/text template and extract a shared Resend send helper to avoid duplicating the Resend API call logic.

### Key Insights

- Existing invite email template in `organization_invite_email.py` is a good reference for HTML structure
- `ResendInviteEmailSender` does generic Resend send — extract the core into a reusable function
- Welcome email needs: user's first name (or fallback), product name, dashboard URL

### Requirements

**Functional:**
- HTML + plain text welcome email with FlowGrid branding (matching invite style)
- Personalized greeting with user's first name (fallback: "there")
- CTA button linking to dashboard
- Responsive design (520px card, same as invite)

**Non-functional:**
- Idempotent sends via Resend idempotency key
- Reuse same Resend error classification (retryable vs non-retryable)

### Related Code Files

**Modify:**
- `backend/app/services/email/resend_sender.py` — extract generic send helper

**Create:**
- `backend/app/services/email/welcome_email.py` — template builder
- `backend/app/services/email/welcome_email_sender.py` — typed contracts (dataclasses + protocol)

### Implementation Steps

1. Create `welcome_email_sender.py` with:
   - `WelcomeEmailContent(subject, text, html)` frozen dataclass
   - `WelcomeEmailSendRequest(user_email, user_id, idempotency_key, content)` frozen dataclass
   - `WelcomeEmailDeliveryError(message, retryable)` — reuse `InviteEmailDeliveryError` pattern
   - `WelcomeEmailSender` protocol with `send_welcome_email(request)` method

2. Create `welcome_email.py` with:
   - `WelcomeEmailRenderInput(first_name, dashboard_url)` frozen dataclass
   - `build_welcome_email(payload) -> WelcomeEmailContent` function
   - HTML template matching FlowGrid brand (dark gradient header, white card body, CTA button)
   - Plain text fallback

3. Refactor `resend_sender.py`:
   - Extract `_send_via_resend(sender, reply_to, send_email, to, subject, html, text, idempotency_key)` shared helper
   - `ResendInviteEmailSender` calls shared helper
   - Add `ResendWelcomeEmailSender` class implementing `WelcomeEmailSender` protocol

### Todo

- [x] Create `welcome_email_sender.py` contracts
- [x] Create `welcome_email.py` template builder
- [x] Extract shared Resend send helper in `resend_sender.py`
- [x] Add `ResendWelcomeEmailSender` class

### Success Criteria

- `build_welcome_email()` returns valid HTML + text content
- Shared Resend helper used by both invite and welcome senders
- No breaking changes to existing invite email flow

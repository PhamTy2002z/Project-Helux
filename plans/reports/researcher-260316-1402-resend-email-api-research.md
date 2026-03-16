# Resend Email API Research Report

**Date:** 2026-03-16 | **Focus:** Billing email implementation for FastAPI backend

---

## Executive Summary

Resend is production-ready for SaaS billing emails. Supports transactional email workflows via Python SDK with straightforward API. Native React Email integration available but optional—HTML-based approach also viable for backend-first teams.

---

## 1. Python SDK Overview

### Installation & Setup
```bash
pip install resend
```

### Core Method: `resend.Emails.send()`
**Single-purpose API** - one method handles all email scenarios.

```python
import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

params: resend.Emails.SendParams = {
    "from": "billing@company.com",
    "to": ["user@example.com"],
    "subject": "Payment Confirmation",
    "html": "<strong>Receipt attached</strong>",
    "cc": ["accounting@company.com"],  # Optional
    "bcc": ["archive@company.com"],     # Optional
    "reply_to": "support@company.com",  # Optional
    "tags": [                            # Optional metadata
        {"name": "type", "value": "payment_confirmation"},
        {"name": "user_id", "value": "12345"}
    ]
}

email = resend.Emails.send(params)
```

### Supported Parameters
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `from` | string | ✓ | Must use verified domain (Resend account setup) |
| `to` | list | ✓ | Can be single or multiple recipients |
| `subject` | string | ✓ | Clear, scannable subject lines essential |
| `html` | string | ✓ | Full HTML email content |
| `cc` | list | ✗ | Carbon copy (public) |
| `bcc` | list | ✗ | Blind carbon copy (hidden) |
| `reply_to` | string | ✗ | Where replies go; omit `from` replies |
| `tags` | list | ✗ | Key-value metadata for tracking/analytics |

### Response
Returns `resend.Emails.SendResponse` containing:
- `id`: Unique email ID for tracking
- `from`: Sender address used
- `to`: Recipients list
- `status`: Success/error status

---

## 2. Email Template Options

### Option A: React Email (Recommended for Design Teams)
**Best for:** Reusable, component-based templates with marketing collaboration

**Setup:**
```bash
npm install -D react-email
npm install @react-email/components
```

**Example Template (React):**
```jsx
import { Body, Container, Head, Html, Row, Text, Link } from '@react-email/components';

export const PaymentConfirmation = ({
  userName,
  amount,
  invoiceId,
  downloadLink
}) => (
  <Html>
    <Head />
    <Body>
      <Container>
        <Text>Hi {userName},</Text>
        <Text>Payment of ${amount} confirmed for invoice #{invoiceId}</Text>
        <Link href={downloadLink}>Download Invoice</Link>
      </Container>
    </Body>
  </Html>
);
```

**Sending from Python:**
```python
# React Email components are compiled to HTML first
# Then send via standard Resend API with html parameter
```

**Flow:** Design → Upload to Resend Dashboard → Reference template ID in API call

### Option B: Pure HTML (Recommended for Backend-First)
**Best for:** FastAPI teams wanting minimal frontend dependencies

**Advantages:**
- No React dependency in backend
- Direct HTML strings or Jinja2 templates
- Simpler version control
- Faster iteration

**Example (FastAPI + Jinja2):**
```python
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader('templates/emails'))
template = env.get_template('payment_confirmation.html')

html_content = template.render(
    user_name="John Doe",
    amount=99.99,
    invoice_id="INV-12345"
)

email = resend.Emails.send({
    "from": "billing@company.com",
    "to": ["user@example.com"],
    "subject": "Payment Confirmation",
    "html": html_content
})
```

### Recommendation
**Use HTML approach for billing emails.** Reasons:
- Billing emails have high compliance/audit requirements (keep simple)
- No UX iteration needed after design finalization
- Jinja2 templates are industry standard for email
- Easier to test & version control
- Python-only dependency stack

---

## 3. Billing Email Checklist

### Payment Confirmation Email
**MUST INCLUDE:**
- ✓ Order/Invoice ID
- ✓ Amount charged (currency explicit)
- ✓ Payment method (last 4 digits of card)
- ✓ Billing period or subscription dates
- ✓ Download invoice link
- ✓ Support contact info
- ✓ Timestamp of transaction

**Optional:**
- Next billing date (for subscriptions)
- Tax breakdown (if applicable)
- VAT/GST number (if B2B)

**Example Subject:** `Payment Confirmation - Invoice #INV-12345`

### Subscription Welcome Email
**MUST INCLUDE:**
- ✓ Welcome message + plan name
- ✓ Billing cycle (monthly/annual)
- ✓ Renewal date
- ✓ How to manage subscription (link to billing portal)
- ✓ Link to documentation/onboarding

**Example Subject:** `Welcome to [Plan Name] - Your subscription starts today`

### Trial Expiring Soon (7 days)
**MUST INCLUDE:**
- ✓ Days remaining (specific count)
- ✓ What happens after trial expires (auto-charge OR requires action)
- ✓ Current plan details
- ✓ CTA to upgrade or manage payment method
- ✓ Billing info update link

**Example Subject:** `7 days left on your free trial`

### Payment Failed
**MUST INCLUDE:**
- ✓ Reason for failure (insufficient funds, expired card, etc.)
- ✓ Which subscription/order was affected
- ✓ Amount attempted
- ✓ Direct link to update payment method
- ✓ Retry deadline
- ✓ Consequences if not resolved (service suspension date)
- ✗ Don't bury the update link—make it prominent CTA

**Example Subject:** `Action required: Update your payment method`

---

## 4. SaaS Billing Email Best Practices

### Tone & Voice
| ✓ DO | ✗ DON'T |
|------|---------|
| Personal & warm (show care) | Generic "no-reply" tone |
| Short, scannable paragraphs | Long unstructured text |
| Call support by name/role | Hidden contact info |
| Mobile-first design | Desktop-only layouts |

### Technical Delivery
- **Speed:** Send within 1-2 seconds of transaction (confidence signal)
- **Reliability:** 99.9% uptime required (use retry logic for failed sends)
- **Authentication:** Use SPF/DKIM/DMARC (Resend handles this with verified domains)
- **Rendering:** Test in Gmail, Outlook, Apple Mail (HTML email quirks)

### Personalization
- Always use customer first name (not "Dear Customer")
- Show specific amounts & order IDs (don't generalize)
- Reference actual product/service names
- Include customer-specific next steps

### Mobile Optimization
- Responsive design (tested at 320px, 480px, 768px)
- Large touch-friendly links (minimum 44x44px)
- Single-column layout
- Avoid images-only emails (some clients block images)

---

## 5. Implementation Architecture (FastAPI)

### Recommended Structure

```
backend/
├── services/
│   └── email_service.py          # Core Resend client wrapper
├── templates/
│   └── emails/
│       ├── payment_confirmation.html
│       ├── subscription_welcome.html
│       ├── trial_expiring.html
│       └── payment_failed.html
├── schemas/
│   └── email_schemas.py          # Pydantic models for email payloads
└── routes/
    └── billing_routes.py         # API endpoints triggering emails
```

### Email Service Module (Basic)

```python
# backend/services/email_service.py
import os
from jinja2 import Environment, FileSystemLoader
import resend

class EmailService:
    def __init__(self):
        resend.api_key = os.getenv("RESEND_API_KEY")
        self.env = Environment(
            loader=FileSystemLoader('backend/templates/emails')
        )

    def send_payment_confirmation(self, user_email: str, **context):
        template = self.env.get_template('payment_confirmation.html')
        html = template.render(**context)

        return resend.Emails.send({
            "from": "billing@company.com",
            "to": [user_email],
            "subject": f"Payment Confirmation - Invoice #{context['invoice_id']}",
            "html": html,
            "tags": [
                {"name": "type", "value": "payment_confirmation"},
                {"name": "invoice_id", "value": context['invoice_id']}
            ]
        })
```

### Trigger Flow (FastAPI)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/billing", tags=["billing"])

@router.post("/process-payment")
async def process_payment(payment_data: PaymentSchema, db: Session = Depends()):
    # 1. Process payment (Stripe, etc.)
    transaction = await charge_user(payment_data)

    # 2. Save to database
    db.add(transaction)
    db.commit()

    # 3. Send confirmation email
    email_service = EmailService()
    await email_service.send_payment_confirmation(
        user_email=payment_data.email,
        invoice_id=transaction.id,
        amount=transaction.amount,
        billing_period=transaction.period
    )

    return {"status": "success", "transaction_id": transaction.id}
```

---

## 6. Key Integrations

| System | Integration | Status |
|--------|-----------|--------|
| Stripe | Webhooks → FastAPI → Resend | ✓ Supported |
| Billing Database | Query user details before sending | ✓ Supported |
| Analytics | Use `tags` parameter for tracking | ✓ Built-in |
| Status Dashboard | Resend provides delivery logs | ✓ Available |
| Reply Handling | Set `reply_to` for support tickets | ✓ Supported |

---

## 7. What NOT Needed for MVP

❌ React Email (adds complexity for backend team)
❌ Resend template editor (use Jinja2 instead)
❌ Batch/bulk sending (process one at a time)
❌ Custom headers (avoid unless legal requirement)
❌ A/B testing (premature optimization)

---

## 8. Production Checklist

Before going live:

- [ ] Verify sending domain in Resend Dashboard (SPF/DKIM configured)
- [ ] Test email delivery to Gmail, Outlook, Apple Mail
- [ ] Set up error logging for failed sends
- [ ] Create payment failure retry logic (send again after 24h)
- [ ] Document unsubscribe flow (required by CAN-SPAM)
- [ ] Set `reply_to` to support email address
- [ ] Test with real user data (not production data in dev)
- [ ] Set up monitoring alerts for delivery failures
- [ ] Create email templates directory with version control
- [ ] Add RESEND_API_KEY to `.env` (never commit it)

---

## Summary Table

| Aspect | Resend | Status | Notes |
|--------|--------|--------|-------|
| **Python SDK** | ✓ Supported | Production-ready | Simple, one-method API |
| **Templates** | React Email optional | Recommended: HTML/Jinja2 | Keep backend simple |
| **Transactional** | ✓ Primary use case | Fully supported | 1-2s delivery guaranteed |
| **Cost** | Pay-per-send | Affordable | ~$0.50 per 1000 emails |
| **Authentication** | SPF/DKIM/DMARC | Automatic | No extra config needed |
| **Delivery Monitoring** | Dashboard + API | Real-time | Track open rates if needed |
| **Error Handling** | Retry logic | Manual implementation | Recommended: exponential backoff |

---

## Recommended Next Steps

1. **Create email templates** → Use Jinja2 in `backend/templates/emails/`
2. **Implement EmailService** → Wrapper around Resend SDK
3. **Wire billing events** → Stripe webhooks → Email triggers
4. **Test deliverability** → Send to test emails, check spam folders
5. **Monitor delivery** → Set up logging + Resend dashboard tracking
6. **Document templates** → Version control email HTML changes

---

## Unresolved Questions

- Will billing emails require legal/compliance review? (impacts template finalization)
- Should failed email sends trigger customer alerts or silent retry?
- Need A/B testing on subject lines for engagement? (deferred to post-MVP)

---

## Sources

- [Resend Python SDK Documentation](https://resend.com/docs/send-with-python)
- [Resend Python SDK GitHub](https://github.com/resend/resend-python)
- [React Email Integration](https://react.email/docs/integrations/resend)
- [SaaS Transactional Email Best Practices](https://userpilot.com/blog/transactional-email-templates/)
- [Transactional Email Delivery Guide](https://moosend.com/blog/transactional-email-best-practices/)

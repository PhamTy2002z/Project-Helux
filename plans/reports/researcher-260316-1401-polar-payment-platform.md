# Polar Payment Platform Research Report
**Date:** 2026-03-16 | **Research ID:** researcher-260316-1401

## Executive Summary

Polar is a SaaS-ready payment platform offering checkout sessions, subscription management, customer portal, and comprehensive webhooks. Supports Python SDK for backend integration. Suitable for implementing a complete payment flow with subscription management, customer self-service, and automated billing.

---

## 1. Checkout Flow

### Session Creation
- **Method:** `POST /checkouts` or `polar.checkouts.create()`
- **Returns:** Object with checkout URL for customer redirection
- **Products:** Support multiple products per session (customer selects before payment)

### Key Parameters
| Parameter | Type | Purpose |
|-----------|------|---------|
| `products` | array | Product IDs to include in checkout |
| `prices` | object (optional) | Ad-hoc dynamic pricing override |
| `external_customer_id` | string | Links Polar customer to your system |
| Metadata | object | Custom data passed through checkout |

### Ad-hoc Pricing
Pass dynamic prices when creating checkout. Types supported:
- Fixed amounts
- Custom/pay-what-you-want
- Free
- Seat-based
- Metered/usage-based

Marked as `source: "ad_hoc"` in response (vs `source: "catalog"` for catalog products).

### Response
- **Checkout URL:** Provided for customer redirection
- **Session ID:** For subsequent API calls
- **external_customer_id:** Appears in webhook `customer.external_id` field after checkout

### Limitations
- Success/cancel URL parameters not documented in provided sources
- Need to verify if custom redirect URLs supported vs fixed Polar domain redirect

---

## 2. Customer Portal

### Access Methods

**Public Portal:**
- URL format: `https://polar.sh/{org-slug}/portal`
- Customer auth: Email-based login

**Pre-Authenticated Links (Recommended for SaaS):**
- Method: `polar.customer_portal.create_session()` or `customerSessions.create()`
- Returns: Direct portal URL bypassing login
- Requires: Valid customer ID

### Capabilities
Customers can self-serve:
- View orders and subscription history
- Upgrade/downgrade subscriptions
- Cancel subscriptions
- Update payment methods
- Download invoices
- Access benefits/access credentials

### Integration Pattern
1. Get authenticated customer session link via API
2. Redirect to portal URL from your app
3. Customer manages subscription without support tickets

---

## 3. Webhook Events

### Subscription Events
| Event | Trigger | Usage |
|-------|---------|-------|
| `subscription.active` | New subscription created/activated | Grant access |
| `subscription.canceled` | Customer cancels | Schedule access revocation |
| `subscription.revoked` | Polar revokes (unpaid) | Revoke access immediately |
| `subscription.updated` | Catch-all for all changes | Sync all subscription updates |

### Order Events
| Event | Trigger | Usage |
|-------|---------|-------|
| `order.created` | Order created | Check billing_reason field |
| `order.paid` | Payment successful | Grant access/confirm purchase |

**Order renewal detection:** Listen to `order.created` with `billing_reason: "subscription_cycle"`

### Checkout Events
| Event | Trigger | Usage |
|-------|---------|-------|
| `checkout.created` | Checkout session created | Track checkout starts |
| `checkout.updated` | Checkout details modified | Track updates/abandonment |

### Webhook Standard
- Follows Standard Webhooks specification
- Signed JSON payloads
- Built-in SDK validation: `polar.webhooks.validate_event()`

### Event Sequence (Subscription Renewal)
```
1. subscription reaches renewal date
2. order.created (billing_reason: "subscription_cycle")
3. order.paid (if successful)
4. subscription continues active
```

---

## 4. Subscription Management API

### Available Operations

**Get Subscription:**
```python
sub = polar.customer_portal.subscriptions.get(id="sub_id")
# Returns: subscription status, current product, renewal date, etc.
```

**List Subscriptions:**
```python
subscriptions = polar.customer_portal.subscriptions.list()
# Returns: paginated list of subscriptions
```

**Update Subscription:**
```python
polar.customer_portal.subscriptions.update(
    id="sub_id",
    request_body={...}  # e.g., upgrade/downgrade product
)
```

**Cancel Subscription:**
```python
polar.customer_portal.subscriptions.cancel(id="sub_id")
# Immediate cancellation
```

### Current Limitations
- Upgrade/downgrade API in development (as of latest docs)
- Currently users upgrade/downgrade from customer portal
- Polar expanding SaaS integrations for deeper control
- Proration settings not yet fully customizable

### Error Handling
- `AlreadyCanceledSubscription` error (403) when canceling already-canceled sub

---

## 5. Python SDK Reference

### Installation
```bash
uv add polar-sdk
# OR
pip install polar-sdk
# OR
poetry add polar-sdk
```

### Basic Client Setup
```python
from polar_sdk import Polar

with Polar(access_token="<TOKEN>") as polar:
    # Make API calls
    pass
```

### Checkout Methods
```python
# Create checkout
checkout = polar.checkouts.create(request_body={
    "products": ["product_id"],
    "external_customer_id": "user_123"
})

# Get existing checkout
checkout = polar.checkouts.get(id="checkout_id")

# List checkouts
checkouts = polar.checkouts.list(page=1, limit=10)

# Update checkout
updated = polar.checkouts.update(id="checkout_id", request_body={...})

# Client-side confirm (for embedded flows)
result = polar.checkouts.client_confirm(id="checkout_id")
```

### Subscription Methods
```python
# List subscriptions
subs = polar.customer_portal.subscriptions.list()

# Get subscription
sub = polar.customer_portal.subscriptions.get(id="sub_id")

# Update subscription (e.g., product change)
polar.customer_portal.subscriptions.update(id="sub_id", request_body={...})

# Cancel subscription
polar.customer_portal.subscriptions.cancel(id="sub_id")
```

### Customer Portal Methods
```python
# Create pre-authenticated portal session
session = polar.customer_sessions.create(customer_id="customer_id")
# Returns: portal_url for redirection
```

### Webhook Validation
```python
from polar_sdk.hooks import validate_event

event = validate_event(
    payload=request.body,
    secret="your_webhook_secret"
)
# Returns validated event or raises exception
```

### Resource Classes
- `organizations` - Org data
- `customers` - Customer information
- `orders` - Order history
- `benefits` - Benefit/access management
- `discounts` - Discount codes
- `webhooks` - Webhook management

### Async Support
```python
async def fetch_subscriptions():
    async with Polar(access_token="<TOKEN>") as polar:
        subs = await polar.customer_portal.subscriptions.list_async()
```

---

## 6. Recommended Integration Pattern

### SaaS Payment Flow
```
1. [Frontend] User clicks "Subscribe"
2. [Backend] Create checkout: polar.checkouts.create()
3. [Frontend] Redirect to checkout.url
4. [Polar] Customer completes payment
5. [Polar] Webhook fires: order.paid
6. [Backend] Grant access, sync subscription
7. [Backend] Store external_customer_id mapping
```

### Subscription Management
```
1. [Frontend] User accesses settings
2. [Frontend] Link to customer portal: polar.customer_sessions.create()
3. [Polar Portal] Customer upgrades/downgrades/cancels
4. [Polar] Webhook fires: subscription.updated
5. [Backend] Sync changes, update access
```

### Access Revocation
```
Webhook: subscription.revoked (payment failed)
   └─> [Backend] Immediately revoke access
   └─> [Backend] May retry before full revocation
```

---

## 7. Implementation Checklist

**Checkout Integration:**
- [ ] Create checkout sessions with product ID
- [ ] Store external_customer_id mapping
- [ ] Implement checkout URL redirect
- [ ] Handle order.paid webhook

**Customer Portal:**
- [ ] Generate pre-authenticated portal links
- [ ] Provide link in user settings
- [ ] Handle post-portal redirect

**Webhook Processing:**
- [ ] Set webhook endpoint URL in Polar dashboard
- [ ] Validate webhook signature with secret
- [ ] Handle: order.paid, subscription.active, subscription.canceled, subscription.revoked
- [ ] Idempotent webhook handlers (can be called multiple times)

**Subscription Sync:**
- [ ] Store subscription ID from webhook
- [ ] Periodically verify subscription status via API
- [ ] Handle renewal via order.created (billing_reason: "subscription_cycle")

**Error Handling:**
- [ ] Handle checkout abandonment
- [ ] Handle failed payments (subscription.past_due)
- [ ] Handle revoked subscriptions (failed billing)
- [ ] Graceful fallback if Polar API unavailable

---

## 8. Key Findings

### Strengths
✓ Simple checkout flow with SDK support
✓ Full-featured customer portal (no custom implementation needed)
✓ Comprehensive webhook coverage
✓ Python SDK well-documented and maintained
✓ Metadata/external customer ID for system integration
✓ Pre-authenticated portal links for seamless UX

### Gaps/Limitations
✗ Upgrade/downgrade API not fully mature (in development)
✗ Success/cancel URL customization not clearly documented
✗ May require verification of webhook response format details
✗ Portal customization options not detailed

### Technical Debt
- Need to handle eventual consistency between webhook events
- Implement webhook retry logic and idempotency keys
- Consider subscription sync job (hourly/daily verification)

---

## Sources

- [Checkout API - Polar.sh Docs](https://polar.sh/docs/features/checkout/session)
- [Webhook Events - Polar](https://polar.sh/docs/integrate/webhooks/events)
- [Customer Portal - Polar.sh Docs](https://polar.sh/docs/features/customer-portal)
- [Subscription Update API - Polar](https://docs.polar.sh/api-reference/subscriptions/update)
- [GitHub - polarsource/polar-python](https://github.com/polarsource/polar-python)
- [Polar Python SDK - PyPI](https://pypi.org/project/polar-sdk/)

---

## Unresolved Questions

1. **Checkout redirect URLs:** Can we customize success/cancel redirect URLs, or are they fixed Polar domains?
2. **Upgrade/downgrade:** When will full upgrade/downgrade API be available? Current status?
3. **Metadata limits:** Are there size limits on metadata passed through checkout?
4. **Webhook retry policy:** How many times will Polar retry failed webhooks? Timeout?
5. **Rate limits:** Any API rate limits on checkout creation or subscription queries?
6. **Customer ID persistence:** Does Polar auto-create customer on first purchase, or do we need to pre-create?

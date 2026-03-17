# Polar Python SDK Research Report

**Date:** 2026-03-17 | **Version Reviewed:** 0.28.4 (latest; 0.18.0 unavailable in search results)

---

## 1. validate_event Function Signature

**Parameter name: `payload`** (NOT `body`)

```python
from polar_sdk.webhooks import validate_event, WebhookVerificationError

event = validate_event(
    payload=request.data,      # Raw request body (bytes)
    headers=request.headers,   # Request headers dict-like object
    secret='<YOUR_WEBHOOK_SECRET>'  # Webhook secret from Polar dashboard
)
```

**Notes:**
- Raises `WebhookVerificationError` on validation failure
- Follows Standard Webhooks specification for signature verification
- Must pass **raw request body** (not parsed JSON) to validate signature
- Headers parameter expects dict-like object (Flask/FastAPI compatible)

---

## 2. Polar() Constructor Initialization

**Server parameter: `server="sandbox"`**

```python
from polar_sdk import Polar

# Production (default)
client = Polar(
    access_token="<YOUR_BEARER_TOKEN>"
)

# Sandbox
client = Polar(
    server="sandbox",
    access_token="<YOUR_BEARER_TOKEN>"
)
```

**Notes:**
- SDK is fully type-hinted with Pydantic validation
- Supports both synchronous and asynchronous operations
- Implements context manager protocol for resource cleanup

---

## 3. Subscription Model Fields (Webhook Payload)

**Available fields confirmed:**

| Category | Fields |
|----------|--------|
| **Lifecycle** | `status`, `started_at`, `ends_at`, `ended_at` |
| **Billing** | `current_period_start`, `current_period_end`, `amount`, `currency`, `recurring_interval`, `recurring_interval_count` |
| **Cancellation** | `cancel_at_period_end`, `canceled_at`, `customer_cancellation_reason`, `customer_cancellation_comment` |
| **Trial** | `trial_start`, `trial_end` |
| **Identifiers** | `id`, `customer_id`, `product_id`, `discount_id`, `checkout_id` |
| **Timestamps** | `created_at`, `modified_at` |
| **Nested** | `customer`, `product`, `discount`, `prices[]`, `meters[]`, `seats` |
| **Custom** | `metadata`, `custom_field_data` |

**Critical Fields for Renewal/Cancellation Logic:**
- `status` - Current subscription state (active, canceled, etc.)
- `current_period_end` - When current billing period expires (ISO 8601)
- `cancel_at_period_end` - Boolean flag: will cancel after current period?
- `canceled_at` - When cancellation was requested (null if active)
- `started_at` - Original subscription start date
- `ended_at` - When subscription actually ended (null if active)

---

## 4. Retry/Backoff Configuration

**Yes, SDK has built-in retry support via `RetryConfig` and `BackoffStrategy`**

```python
from polar_sdk import Polar
from polar_sdk.utils import BackoffStrategy, RetryConfig

client = Polar(
    retry_config=RetryConfig(
        strategy="backoff",
        backoff_strategy=BackoffStrategy(
            initial_delay=1,      # 1 second
            max_delay=50,         # 50 seconds
            exponent=1.1,         # Exponential factor
            max_retries=100       # Max attempts
        ),
        retry_on_timeout=False
    ),
    access_token="<YOUR_TOKEN>"
)
```

**Parameters:**
- `initial_delay` - Starting delay between retries (seconds)
- `max_delay` - Cap on exponential backoff (seconds)
- `exponent` - Multiplier for exponential backoff (1.1 = 10% increase per retry)
- `max_retries` - Total number of retry attempts
- `retry_on_timeout` - Whether to retry on timeout errors

**Default behavior not explicitly documented** — check source code if defaults needed.

---

## 5. Webhook Event Ordering & Idempotency

**Polar's recommendations (no guaranteed ordering):**

1. **Acknowledge immediately with 202** — Don't process in webhook handler (2 second timeout)
2. **Queue for async processing** — Use background worker to avoid blocking
3. **Implement idempotency** — Use event ID as unique key for deduplication
4. **Guard against out-of-order events** — Don't let older updates overwrite newer state

**Event Structure includes:**
- Unique event ID (remains unchanged across retries)
- Event timestamp (useful for ordering/sequencing)
- Standard Webhooks signature format

**Recommended Guards:**
- Check `event.id` against processed event log (deduplicate)
- Use timestamps or sequence numbers to reject stale updates
- Implement "only move forward" logic: don't apply updates older than current state

**No built-in event ordering guarantee** — Polar may deliver events out-of-order, especially on retries or network issues.

---

## Unresolved Questions

1. **Default retry config values** — What are SDK defaults if not specified?
2. **Webhook event ID field name** — Is it `id`, `event_id`, or `webhook_id`?
3. **Version 0.18.0 specifics** — Current search results show v0.28.4; v0.18.0 may have API differences
4. **Subscription state enum values** — What are valid values for `status` field?

---

## Sources

- [GitHub - polarsource/polar-python](https://github.com/polarsource/polar-python)
- [Polar SDK for Python - PyPI](https://pypi.org/project/polar-sdk/)
- [Python SDK - Polar Docs](https://polar.sh/docs/integrate/sdk/python)
- [Handle & monitor webhook deliveries - Polar](https://polar.sh/docs/integrate/webhooks/delivery)
- [Guide to Polar Webhooks Features and Best Practices](https://hookdeck.com/webhooks/platforms/guide-to-polar-webhooks-features-and-best-practices)
- [subscription.updated - Polar API Reference](https://polar.sh/docs/api-reference/webhooks/subscription.updated)

# Polar Integration Deep Review — Cross-Reference với Official Docs

## Context
- **Polar SDK version**: `>=0.18.0` (pyproject.toml)
- **Sources**: Polar Python SDK docs, Polar API Reference (docs.polar.sh), FlowGrid implementation
- **Scope**: Webhook handling, checkout, customer portal, subscription lifecycle

---

## BUG / DISCREPANCY FINDINGS

### BUG-1: `validate_event` Parameter Name — `body` vs `payload` ⚠️

**Polar SDK official example** (Flask):
```python
event = validate_event(
    payload=request.data,    # <-- "payload"
    headers=request.headers,
    secret='<YOUR_WEBHOOK_SECRET>',
)
```

**FlowGrid implementation** (`billing_webhooks.py:35`):
```python
event = validate_event(
    body=body,               # <-- "body"
    headers=headers,
    secret=settings.polar_webhook_secret,
)
```

**Risk**: Nếu SDK version mới rename parameter từ `body` → `payload`, webhook verification sẽ **silent fail** hoặc raise unexpected error. Cần verify xem polar-sdk 0.18.x accept cả hai hay không.

**Action**: Pin SDK version chính xác + verify parameter name match.

---

### BUG-2: `polar_environment` Config Không Được Sử Dụng ❌

**Config** (`config.py`):
```python
polar_environment: str = "sandbox"  # validated: "sandbox" | "production"
```

**Polar client init** (`polar_client.py:33`):
```python
_client = Polar(access_token=settings.polar_access_token)
# ❌ KHÔNG truyền server/environment parameter!
```

**Polar SDK docs** cho thấy `Polar()` constructor có `server` parameter để chọn sandbox vs production.

**Risk**:
- `POLAR_ENVIRONMENT=sandbox` nhưng client vẫn hit **production API**
- Hoặc ngược lại: production config nhưng test data leak vào sandbox
- **Config validation passes nhưng không có effect thực tế**

**Action**: Truyền `server` parameter khi init Polar client dựa trên `polar_environment`.

---

### BUG-3: `subscription.canceled` Bỏ Qua `current_period_end` ❌

**Polar webhook payload** (`subscription.canceled`):
```json
{
  "type": "subscription.canceled",
  "data": {
    "id": "sub_123abc",
    "status": "canceled",
    "current_period_end": "2023-11-01T00:00:00Z",
    "canceled_at": "2023-10-27T10:00:00Z"
  }
}
```

**FlowGrid handler** (`billing_webhook_service.py:125-132`):
```python
async def _handle_subscription_canceled(...) -> None:
    """Subscription canceled -- keep pro until period end (log only)."""
    logger.info(
        "Org %s subscription canceled via Polar (pro remains until period end)",
        organization_id,
    )
    # ❌ KHÔNG đọc current_period_end
    # ❌ KHÔNG set effective_until = current_period_end
    # ❌ KHÔNG lưu canceled_at
```

**Consequence**:
1. User cancel trên Polar portal
2. Polar gửi `subscription.canceled` với `current_period_end = 2024-02-01`
3. FlowGrid **chỉ log**, không cập nhật plan
4. User giữ **pro access vĩnh viễn** nếu `subscription.revoked` webhook bị lost
5. Không có cách detect user đã cancel → không thể gửi win-back email

**Action**: Parse `current_period_end` từ event data, set `plan.effective_until = current_period_end`.

---

### BUG-4: `subscription.uncanceled` Không Được Handle ❌

**Polar docs** liệt kê event `subscription.uncanceled`:
> "Fired when a canceled subscription is uncanceled."

**FlowGrid** `HANDLED_EVENTS`:
```python
HANDLED_EVENTS = {
    "subscription.active",
    "subscription.revoked",
    "subscription.canceled",
    "order.paid",
    # ❌ THIẾU: "subscription.uncanceled"
    # ❌ THIẾU: "subscription.created"
    # ❌ THIẾU: "subscription.updated"
}
```

**Scenario**:
1. User cancel subscription → FlowGrid set `effective_until` (nếu fix BUG-3)
2. User đổi ý, re-activate trên Polar portal → Polar gửi `subscription.uncanceled`
3. FlowGrid **bỏ qua event** → `effective_until` vẫn giữ → user bị block sau period end
4. User đã trả tiền nhưng bị mất access

**Action**: Handle `subscription.uncanceled` → clear `effective_until`, restore pro.

---

### BUG-5: Webhook Exception Handling Quá Rộng

**FlowGrid** (`billing_webhooks.py:40`):
```python
except Exception as exc:  # ❌ Quá generic
```

**Polar SDK** provides specific exception:
```python
from polar_sdk.webhooks import WebhookVerificationError

except WebhookVerificationError as e:  # ✅ Specific
    return "", 403
```

**Risk**: Catch `Exception` sẽ mask non-verification errors (import errors, SDK bugs, network issues). Tất cả đều trả 400 — impossible to distinguish signature failure vs internal error.

**Action**: Catch `WebhookVerificationError` specifically, let other exceptions propagate as 500.

---

### BUG-6: Customer Portal Missing `return_url`

**Polar docs** — Customer session create supports `return_url`:
```json
{
  "customer_id": "cust_123",
  "return_url": "https://app.flowgrid.io/settings"  // Back button
}
```

**FlowGrid** (`billing.py:285-287`):
```python
portal_session = await client.customer_sessions.create_async(
    request={"customer_id": customer_id}
    # ❌ THIẾU return_url → user mắc kẹt trên Polar portal, không có nút quay về
)
```

**Action**: Pass `return_url` pointing to FlowGrid settings page.

---

### BUG-7: Checkout Missing `customer_id` / `external_customer_id`

**Polar checkout API** supports linking existing customer:
```json
{
  "products": ["..."],
  "customer_id": "<existing polar customer>",
  "external_customer_id": "<your system's org ID>",
  "subscription_id": "<for upgrades>"
}
```

**FlowGrid** (`billing.py:228-239`):
```python
checkout = await client.checkouts.create_async(
    request={
        "products": [product_id],
        "success_url": success_url,
        "customer_email": user_email or None,
        "metadata": {...},
        # ❌ THIẾU customer_id (khi user đã có Polar customer)
        # ❌ THIẾU external_customer_id (FlowGrid org ID)
    }
)
```

**Consequence**:
- Mỗi checkout tạo **new Polar customer** thay vì link existing
- User checkout 2 lần → 2 Polar customers → quản lý subscription rối
- Polar portal chỉ show 1 subscription, không thấy history đầy đủ

**Action**: Nếu `plan_metadata.billing.polar_customer_id` exists → truyền `customer_id`. Luôn truyền `external_customer_id = str(organization_id)`.

---

## MISSING WEBHOOK EVENTS

| Polar Event | FlowGrid | Impact | Priority |
|------------|----------|--------|----------|
| `subscription.created` | ❌ Not handled | Không track khi subscription tạo lần đầu | P2 |
| `subscription.active` | ✅ Handled | — | — |
| `subscription.updated` | ❌ Not handled | Miss renewals, plan changes | P1 |
| `subscription.canceled` | ⚠️ Log only | User giữ pro vĩnh viễn | **P0** |
| `subscription.uncanceled` | ❌ Not handled | Re-activated user bị block | **P0** |
| `subscription.revoked` | ✅ Handled | — | — |
| `order.paid` | ✅ Handled (log) | — | — |
| `order.created` | ❌ Not handled | Miss renewal tracking (`billing_reason`) | P1 |
| `order.updated` | ❌ Not handled | Miss payment status changes | P2 |
| `checkout.created` | ❌ Not handled | No audit of checkout initiation | P2 |
| `checkout.updated` | ❌ Not handled | Miss checkout status changes (expired, failed) | P1 |
| `customer.created` | ❌ Not handled | No customer lifecycle tracking | P2 |
| `customer.updated` | ❌ Not handled | Miss email/name changes | P3 |
| `customer.state_changed` | ❌ Not handled | Miss customer status changes | P2 |

---

## SUBSCRIPTION MODEL FIELDS NOT STORED

Polar `Subscription` model có nhiều field quan trọng mà FlowGrid **không lưu**:

| Polar Field | Stored? | Why It Matters |
|------------|---------|---------------|
| `status` (active/canceled/revoked) | ❌ | Không biết subscription state thực tế |
| `current_period_end` | ❌ | Không biết khi nào billing period kết thúc |
| `canceled_at` | ❌ | Không biết user cancel bao giờ |
| `started_at` | ❌ | Không biết subscription bắt đầu bao giờ |
| `ends_at` | ❌ | Không biết subscription scheduled end |
| `ended_at` | ❌ | Không biết subscription đã end chưa |
| `customer_id` | ✅ | Stored in plan_metadata |

**Recommendation**: Mở rộng `plan_metadata.billing` để lưu các field lifecycle:
```python
"billing": {
    "polar_subscription_id": "sub_xxx",
    "polar_customer_id": "cus_xxx",
    "polar_subscription_status": "active",        # NEW
    "polar_current_period_end": "2024-02-01T...",  # NEW
    "polar_canceled_at": null,                      # NEW
    "polar_started_at": "2024-01-01T...",          # NEW
}
```

---

## SECURITY FINDINGS

### SEC-1: Polar Client Không Set Server Environment
- Sandbox requests có thể hit production hoặc ngược lại
- **Severity**: HIGH — financial impact nếu sandbox token dùng ở production

### SEC-2: Webhook No Replay Protection (Ordering)
- `subscription.active` → `subscription.canceled` → delayed `subscription.active` replay
- Last event wins → user re-activated incorrectly
- **Severity**: MEDIUM — requires webhook timestamp comparison

### SEC-3: No Polar Customer Deduplication
- Multiple checkouts = multiple Polar customers cho cùng org
- **Severity**: MEDIUM — billing confusion, hard to reconcile

### SEC-4: Checkout Session No Timeout Handling
- Polar checkout response includes `expires_at` — FlowGrid ignores
- Expired checkout link still shown to user
- **Severity**: LOW — Polar handles expiry server-side

---

## COMPLETE FIX PRIORITY LIST

### P0 — Must Fix (Revenue / Access Impact)

| # | Issue | File | Risk |
|---|-------|------|------|
| 1 | BUG-2: `polar_environment` not passed to client | `polar_client.py` | Sandbox/prod confusion |
| 2 | BUG-3: `subscription.canceled` ignores `current_period_end` | `billing_webhook_service.py` | Infinite pro access |
| 3 | BUG-4: `subscription.uncanceled` not handled | `billing_webhook_service.py` | Paying user blocked |
| 4 | BUG-7: Missing `customer_id` on repeat checkout | `billing.py` | Duplicate Polar customers |

### P1 — Should Fix (Reliability)

| # | Issue | File | Risk |
|---|-------|------|------|
| 5 | BUG-1: `validate_event` param name verify | `billing_webhooks.py` | SDK upgrade breakage |
| 6 | BUG-5: Generic exception catch on webhook verify | `billing_webhooks.py` | Masked errors |
| 7 | BUG-6: Missing `return_url` on portal session | `billing.py` | UX dead-end |
| 8 | Handle `subscription.updated` for renewals | `billing_webhook_service.py` | Miss renewal events |
| 9 | Handle `checkout.updated` for failed/expired | `billing_webhook_service.py` | No checkout failure visibility |
| 10 | Store subscription lifecycle fields | `billing_webhook_service.py` | No local state visibility |

### P2 — Nice to Have

| # | Issue | File |
|---|-------|------|
| 11 | Handle `subscription.created` | `billing_webhook_service.py` |
| 12 | Handle `order.created` with `billing_reason` | `billing_webhook_service.py` |
| 13 | Handle `customer.*` events | `billing_webhook_service.py` |
| 14 | Track checkout `expires_at` | `billing.py` |

---

## ANTI-PATTERNS VS POLAR BEST PRACTICES

### 1. "Metadata-Only Org Binding"
**Current**: Organization ID passed via checkout `metadata`, extracted from webhook `metadata`.
**Risk**: If metadata is stripped or corrupted by Polar, org link is lost.
**Polar Best Practice**: Use `external_customer_id = str(organization_id)` for stable binding. Metadata is supplementary.

### 2. "Webhook-Only State"
**Current**: Plan state 100% driven by webhooks. No Polar API polling.
**Polar Best Practice**: Periodically call `customer_portal.subscriptions.list()` to verify local state matches Polar.

### 3. "Singleton Client Without Server Config"
**Current**: `Polar(access_token=...)` — no server parameter.
**Polar Best Practice**: `Polar(access_token=..., server="sandbox")` for explicit environment control.

---

## Unresolved Questions

1. `polar-sdk >= 0.18.0` — `validate_event` chấp nhận `body=` hay chỉ `payload=`?
2. Polar sandbox behavior có identical với production cho webhook events không?
3. `Polar()` constructor syntax cho `server` param trong version 0.18.x cụ thể là gì?
4. Checkout metadata size limit? Nếu metadata quá lớn Polar có truncate không?
5. Khi user checkout lần 2 (renewal/upgrade), Polar tự link existing customer hay tạo mới?
6. `subscription.revoked` có guarantee gửi sau `subscription.canceled` không? Hay có thể gửi riêng?

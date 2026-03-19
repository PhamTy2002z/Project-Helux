---
phase: 1
status: pending
priority: P0
effort: S
---

# Phase 1: Polar Client Foundation Fixes

## Context
- [Polar Cross-Reference Report](../reports/brainstorm-260317-1515-polar-cross-reference-deep-review.md)
- Fixes: BUG-2 (env not passed), BUG-1 (validate_event param), BUG-5 (generic exception)

## Overview

3 independent fixes in Polar SDK integration layer. No DB changes. No API contract changes.

## Key Insights

- `Polar()` constructor accepts `server` param for sandbox/production routing
- `validate_event` — SDK docs show `payload=` but code uses `body=`. Need to verify SDK source.
- Polar SDK exports `WebhookVerificationError` for specific exception handling

## Related Code Files

**Modify:**
- `backend/app/services/polar_client.py` (36 lines)
- `backend/app/api/billing_webhooks.py` (52 lines)

## Implementation Steps

### 1.1 Fix Polar client environment routing (BUG-2)

File: `backend/app/services/polar_client.py`

```python
# BEFORE (line 33):
_client = Polar(access_token=settings.polar_access_token)

# AFTER:
_server = "sandbox" if settings.polar_environment == "sandbox" else None
_client = Polar(
    access_token=settings.polar_access_token,
    server=_server,  # None = production default
)
```

**Note**: Verify exact `server` param values from Polar SDK source. May be `"sandbox"` string or enum. If SDK uses `server_url`, adjust accordingly.

### 1.2 Fix validate_event parameter name (BUG-1)

File: `backend/app/api/billing_webhooks.py`

Check actual SDK source for `validate_event` signature:
```python
# If SDK uses `payload=`:
event = validate_event(
    payload=body,   # was: body=body
    headers=headers,
    secret=settings.polar_webhook_secret,
)
```

**Important**: Only change if SDK source confirms `payload` is the param name. If SDK accepts both `body` and `payload` via `**kwargs`, keep `body=` but add code comment noting the canonical name.

### 1.3 Specific webhook exception handling (BUG-5)

File: `backend/app/api/billing_webhooks.py`

```python
# BEFORE:
from polar_sdk.webhooks import validate_event
# ...
except Exception as exc:

# AFTER:
from polar_sdk.webhooks import validate_event, WebhookVerificationError

try:
    event = validate_event(...)
except WebhookVerificationError as exc:
    logger.warning("Polar webhook signature failed: %s", exc)
    raise HTTPException(status_code=400, detail="Invalid webhook signature.") from exc
# Other exceptions propagate as 500 (intentional)
```

## Todo List

- [ ] 1.1 Pass `polar_environment` to Polar client constructor
- [ ] 1.2 Verify + fix `validate_event` parameter name
- [ ] 1.3 Catch `WebhookVerificationError` specifically
- [ ] 1.4 Run compile check: `cd backend && python -m py_compile app/services/polar_client.py`
- [ ] 1.5 Run compile check: `cd backend && python -m py_compile app/api/billing_webhooks.py`

## Success Criteria

- `polar_environment=sandbox` routes SDK calls to sandbox API
- `polar_environment=production` routes to production
- Webhook verification errors return 400; other errors return 500
- Existing tests pass

## Risk Assessment

- **Low risk**: Changes are isolated to 2 files, no DB/API impact
- **SDK compatibility**: Must verify param names against pinned SDK version before changing

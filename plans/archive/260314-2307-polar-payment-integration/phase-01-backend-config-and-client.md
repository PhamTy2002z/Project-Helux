---
phase: 1
title: "Backend Config & Polar Client"
status: pending
effort: 1h
---

# Phase 1: Backend Config & Polar Client

## Context

- [config.py](../../backend/app/core/config.py) -- current config with `BILLING_MODES`, `PAYMENT_PROVIDERS`
- [pyproject.toml](../../backend/pyproject.toml) -- dependency management (no requirements.txt)

## Overview

Add `"polar"` to allowed payment providers, add Polar env vars to Settings, create async Polar client singleton.

## Related Code Files

**Modify:**
- `backend/app/core/config.py`
- `backend/pyproject.toml`

**Create:**
- `backend/app/services/polar_client.py`

## Implementation Steps

### 1. Add polar-sdk dependency

In `backend/pyproject.toml`, add to `dependencies` array:
```
"polar-sdk>=0.18.0",
```

### 2. Update config.py

**2a.** Add `"polar"` to `PAYMENT_PROVIDERS` frozenset (line 28):
```python
PAYMENT_PROVIDERS = frozenset({"none", "stripe", "paddle", "polar"})
```

**2b.** Add Polar env vars to `Settings` class (after `payment_provider` field, ~line 148):
```python
# Polar payment provider
polar_access_token: str = ""
polar_webhook_secret: str = ""
polar_product_price_id_pro: str = ""
polar_environment: str = "sandbox"  # "sandbox" or "production"
polar_success_url: str = ""  # e.g. https://flowgrid.live/checkout/success?checkout_id={CHECKOUT_ID}
```

**2c.** Add validation in `_defaults` method -- only require Polar vars when `payment_provider == "polar"`:
```python
if self.payment_provider == "polar":
    if not self.polar_access_token.strip():
        raise ValueError("POLAR_ACCESS_TOKEN required when PAYMENT_PROVIDER=polar.")
    if not self.polar_webhook_secret.strip():
        raise ValueError("POLAR_WEBHOOK_SECRET required when PAYMENT_PROVIDER=polar.")
    if not self.polar_product_price_id_pro.strip():
        raise ValueError("POLAR_PRODUCT_PRICE_ID_PRO required when PAYMENT_PROVIDER=polar.")
    if self.polar_environment not in ("sandbox", "production"):
        raise ValueError("POLAR_ENVIRONMENT must be 'sandbox' or 'production'.")
```

### 3. Create polar_client.py

New file: `backend/app/services/polar_client.py` (~40 lines)

```python
"""Lazy-initialized async Polar SDK client singleton."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from polar_sdk import AsyncPolar

logger = logging.getLogger(__name__)

_client: AsyncPolar | None = None


def get_polar_client() -> AsyncPolar:
    """Return shared AsyncPolar instance. Raises if provider != polar."""
    global _client
    if _client is not None:
        return _client

    if settings.payment_provider != "polar":
        raise RuntimeError(
            "Polar client requested but PAYMENT_PROVIDER != 'polar'."
        )

    from polar_sdk import AsyncPolar

    _client = AsyncPolar(access_token=settings.polar_access_token)
    logger.info("Polar client initialized (env=%s)", settings.polar_environment)
    return _client
```

Key points:
- Lazy import of `polar_sdk` so it doesn't break when not installed or not configured
- Singleton pattern -- one client per process
- Guard: raises if called when provider is not polar

## Todo

- [ ] Add `polar-sdk` to pyproject.toml dependencies
- [ ] Add `"polar"` to `PAYMENT_PROVIDERS` frozenset
- [ ] Add Polar env vars to Settings class
- [ ] Add conditional validation for Polar vars
- [ ] Create `polar_client.py` with singleton pattern
- [ ] Run `uv sync` to install dependency

## Success Criteria

- `PAYMENT_PROVIDER=polar` accepted by config validator
- `PAYMENT_PROVIDER=polar` without `POLAR_ACCESS_TOKEN` raises clear error
- `get_polar_client()` returns AsyncPolar instance when configured
- Existing `BILLING_MODE=simulated` still works without Polar vars

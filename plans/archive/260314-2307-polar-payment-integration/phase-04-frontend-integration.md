---
phase: 4
title: "Frontend Integration"
status: pending
effort: 1h
depends_on: [2]
---

# Phase 4: Frontend Integration

## Context

- [billing.ts](../../frontend/src/lib/billing.ts) -- frontend billing hooks/API
- [upgrade-modal.tsx](../../frontend/src/components/billing/upgrade-modal.tsx) -- upgrade modal component

## Overview

Update frontend to call real checkout endpoint when `billing_mode === "provider"`. On success, redirect to Polar hosted checkout page instead of flipping plan locally.

## Related Code Files

**Modify:**
- `frontend/src/lib/billing.ts` -- add `createCheckout` function + hook
- `frontend/src/components/billing/upgrade-modal.tsx` -- branch on billing_mode

## Implementation Steps

### 1. Add checkout API function to billing.ts

```typescript
type CheckoutPayload = {
  plan_tier: BillingPlanTier;
  idempotency_key: string;
};

type CheckoutResponse = {
  checkout_url: string;
  checkout_id: string;
  provider: string;
};

type CheckoutApiResponse = {
  data: CheckoutResponse;
  status: number;
  headers: Headers;
};

export const createCheckout = async (
  payload: CheckoutPayload,
): Promise<CheckoutResponse> => {
  const response = await customFetch<CheckoutApiResponse>(
    "/api/v1/billing/checkout",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const useCreateCheckout = () =>
  useMutation({
    mutationFn: createCheckout,
  });
```

### 2. Update upgrade-modal.tsx

Add branching logic based on `billing_mode` from subscription response:

```typescript
const isProviderMode = subscriptionQuery.data?.billing_mode === "provider";

const createCheckoutMutation = useCreateCheckout();

const onCheckout = async () => {
  setCheckoutError(null);

  if (isProviderMode) {
    // Real checkout: redirect to payment provider
    try {
      const result = await createCheckoutMutation.mutateAsync({
        plan_tier: selectedTier,
        idempotency_key: createIdempotencyKey(),
      });
      // Redirect to Polar checkout page
      window.location.href = result.checkout_url;
    } catch (error) {
      if (error instanceof ApiError) {
        setCheckoutError(error.message || "Unable to start checkout.");
        return;
      }
      setCheckoutError("Unable to start checkout.");
    }
  } else {
    // Simulated checkout (existing flow, unchanged)
    try {
      await simulateCheckoutMutation.mutateAsync({
        plan_tier: selectedTier,
        idempotency_key: createIdempotencyKey(),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: getQuotaUsageApiV1MetricsQuotasGetQueryKey(),
        }),
      ]);
      handleOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setCheckoutError(error.message || "Unable to unlock plan.");
        return;
      }
      setCheckoutError("Unable to unlock plan.");
    }
  }
};
```

Update button text:
```typescript
const isSubmitting = simulateCheckoutMutation.isPending || createCheckoutMutation.isPending;

// Button label
{isSubmitting
  ? (isProviderMode ? "Redirecting..." : "Unlocking...")
  : (isProviderMode ? "Proceed to checkout" : "Confirm unlock")}
```

Update modal description:
```typescript
{reason ??
  (isProviderMode
    ? "Choose a plan and proceed to secure checkout."
    : "Unlock subscription in one step. This billing flow is simulated in v1.")}
```

### 3. Add import

In upgrade-modal.tsx:
```typescript
import { useCreateCheckout } from "@/lib/billing";
```

## Todo

- [ ] Add `createCheckout` function to billing.ts
- [ ] Add `useCreateCheckout` hook to billing.ts
- [ ] Add `CheckoutPayload` and `CheckoutResponse` types to billing.ts
- [ ] Update `onCheckout` in upgrade-modal.tsx to branch on billing_mode
- [ ] Update button text for provider mode
- [ ] Update modal description for provider mode
- [ ] Update `isSubmitting` to include both mutations

## Success Criteria

- Simulated mode: behavior unchanged (local plan flip)
- Provider mode: clicking checkout redirects to Polar hosted page
- Error states handled for both modes
- Button shows appropriate text per mode

## Risk Assessment

- **Redirect UX** -- user leaves the app. After Polar checkout completes, user lands on success URL. May need a `/checkout/success` page that refreshes subscription state. **YAGNI for now** -- Polar success page will redirect back, subscription update comes via webhook.
- **No success page needed initially** -- the webhook will update the plan. User can just navigate back and refresh.

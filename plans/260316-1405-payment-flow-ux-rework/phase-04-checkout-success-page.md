# Phase 04 -- Checkout Success Page

## Context Links
- Plan: `plan.md`
- Phase 01 (pricing CTA routing -- creates the checkout flow)
- Billing service: `backend/app/services/billing.py` (success_url config)
- Billing lib: `frontend/src/lib/billing.ts`

## Overview
- **Priority:** P1
- **Status:** done
- **Depends on:** Phase 1 (CTA routing to Polar checkout)
- **Description:** Create `/checkout/success` page that Polar redirects to after successful payment. Celebration UI + plan summary + CTAs.

## Key Insights
- Polar `success_url` configured in backend: `{base_url}/checkout/success?checkout_id={CHECKOUT_ID}`
- Polar replaces `{CHECKOUT_ID}` placeholder with actual checkout ID on redirect
- By the time user lands here, webhook may or may not have fired yet
- Plan activation happens via webhook (`subscription.active` -> `_handle_subscription_active`)
- Page should poll subscription status briefly to confirm plan is active
- If webhook hasn't fired yet, show "Activating your plan..." with auto-refresh

## Requirements
### Functional
- Celebration animation (confetti or success animation)
- Plan summary: "You're now on Pro" with key unlocked features
- CTA buttons: "Go to Dashboard" / "Create New Board"
- Handle case where plan isn't activated yet (webhook delay) -- show "Activating..." + auto-refresh
- Show checkout_id for support reference

### Non-Functional
- Page loads fast (no heavy deps)
- Confetti: use lightweight CSS animation or `canvas-confetti` (small package)
- Auto-refresh: poll subscription every 2s for up to 30s, then show manual refresh

## Architecture

```
Polar checkout complete
  |
  +-> Redirect to /checkout/success?checkout_id=xxx
       |
       +-> Page mounts, reads checkout_id from URL
       +-> Fetch subscription via useBillingSubscription
       +-> plan_tier === "pro" ? Show success : Show "Activating..."
       +-> Auto-refetch subscription every 2s (max 15 attempts)
```

## Related Code Files

| File | Action |
|------|--------|
| `frontend/src/app/(app)/checkout/success/page.tsx` | CREATE -- success page |
| `frontend/src/lib/billing.ts` | NO CHANGE -- `useBillingSubscription` already exists |
| `backend/app/services/billing.py` | VERIFY -- `success_url` format correct |

## Implementation Steps

### 1. Create success page
Create `frontend/src/app/(app)/checkout/success/page.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useBillingSubscription } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkout_id");
  const [pollCount, setPollCount] = useState(0);

  const subscriptionQuery = useBillingSubscription(true);
  const isPro = subscriptionQuery.data?.plan_tier === "pro";
  const isActivating = !isPro && pollCount < 15;

  useEffect(() => {
    if (isPro || pollCount >= 15) return;
    const timer = setTimeout(() => {
      subscriptionQuery.refetch();
      setPollCount((c) => c + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isPro, pollCount, subscriptionQuery]);

  // Render: success state or activating state
}
```

### 2. Success state UI
```
+------------------------------------------+
|          [confetti animation]            |
|                                          |
|    [CheckCircle icon, green, large]      |
|                                          |
|    Welcome to Pro!                       |
|    Your plan is now active.              |
|                                          |
|    What's unlocked:                      |
|    - 2 board groups                      |
|    - 3 boards                            |
|    - 15 agents                           |
|    - 200M tokens/month                   |
|                                          |
|    [Go to Dashboard]  [Create New Board] |
|                                          |
|    Ref: checkout_id (small, muted)       |
+------------------------------------------+
```

### 3. Activating state UI
```
+------------------------------------------+
|    [Spinner]                             |
|    Activating your Pro plan...           |
|    This usually takes a few seconds.     |
+------------------------------------------+
```
If 30s elapsed (pollCount >= 15), show:
```
|    Plan activation is taking longer      |
|    than expected. Your payment was        |
|    successful.                            |
|    [Refresh] [Go to Dashboard]           |
```

### 4. Confetti animation
Use CSS keyframe animation (no external dependency):
```css
/* Simple confetti using pseudo-elements or a small canvas script */
```
Or install `canvas-confetti` (~3KB gzipped) and trigger on mount when `isPro` becomes true.

## Todo List
- [ ] Create `frontend/src/app/(app)/checkout/success/page.tsx`
- [ ] Success state with celebration UI
- [ ] Activating state with polling
- [ ] Timeout fallback with manual refresh
- [ ] CTA buttons: Dashboard + Create Board
- [ ] Show checkout reference ID
- [ ] Test: immediate success (webhook already fired)
- [ ] Test: delayed activation (webhook pending)
- [ ] Test: timeout scenario (>30s)

## Success Criteria
- User sees celebration UI after successful Polar checkout
- Plan summary shows unlocked features
- CTAs lead to dashboard and board creation
- Handles webhook delay gracefully with auto-polling

## Risk Assessment
- **Webhook delay >30s:** Rare with Polar. User sees reassurance message + can navigate away.
- **Double visit:** Idempotent -- just shows current plan status.
- **No checkout_id in URL:** Page still works, just doesn't show reference ID.

## Security Considerations
- Page requires auth (under `(app)` route group)
- checkout_id in URL is not sensitive (Polar checkout IDs are UUIDs)
- No payment data displayed on this page

## Next Steps
- Verify `success_url` in `billing.py` matches the route: `/checkout/success?checkout_id={CHECKOUT_ID}`

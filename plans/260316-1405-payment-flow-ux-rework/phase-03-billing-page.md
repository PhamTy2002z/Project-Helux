# Phase 03 -- Billing Page in Settings

## Context Links
- Plan: `plan.md`
- Current settings: `frontend/src/app/(app)/settings/page.tsx`
- Billing lib: `frontend/src/lib/billing.ts`
- Quota summary: `frontend/src/components/billing/quota-summary.tsx`
- Plan labels: `frontend/src/lib/plan-labels.ts`
- Polar portal endpoint: Phase 07

## Overview
- **Priority:** P1
- **Status:** done
- **Depends on:** Phase 7 (backend portal endpoint)
- **Description:** Expand the "Billing & usage" section in Settings into a full billing page with plan info, usage meters, and Polar customer portal link.

## Key Insights
- Settings page already has a "Billing & usage" section with plan label + QuotaSummary
- Rather than a separate route, expand the existing section into a richer billing card
- Polar customer portal handles: invoices, payment methods, cancel/upgrade -- link out to it
- `GET /api/v1/billing/portal-session` (Phase 7) returns portal URL
- Subscription data already available via `useBillingSubscription` hook
- Quota data already available via `useQuotaUsageApiV1MetricsQuotasGet`

## Requirements
### Functional
- **Plan badge:** Show current tier (Trial / Pro) with colored badge
- **Plan status:** "Active" / "Trial expires in X days" / "Runtime blocked"
- **Trial countdown:** If trial, show days remaining with color coding (green >3d, yellow 1-3d, red <1d)
- **Usage meters:** Expand QuotaSummary with visual progress bars (color-coded green/yellow/red)
- **Manage subscription button:** Opens Polar customer portal in new tab
- **Upgrade button:** Opens upgrade modal (Pro users see "Manage" instead)

### Non-Functional
- Keep settings page under 200 lines (extract billing section into separate component)
- Responsive: single column on mobile, two columns on desktop for plan info + usage

## Architecture

```
Settings page
  |
  +-- Profile section (existing, unchanged)
  |
  +-- BillingSection component (new, extracted)
  |     |
  |     +-- Plan badge + status + trial countdown
  |     +-- Usage meters (enhanced QuotaSummary)
  |     +-- Action buttons: Upgrade / Manage Subscription
  |     +-- "Manage subscription" -> GET /billing/portal-session -> open portal URL
  |
  +-- Delete account section (existing, unchanged)
```

## Related Code Files

| File | Action |
|------|--------|
| `frontend/src/app/(app)/settings/page.tsx` | MODIFY -- extract billing section into component |
| `frontend/src/components/billing/billing-settings-section.tsx` | CREATE -- billing card component |
| `frontend/src/lib/billing.ts` | MODIFY -- add `usePortalSession` hook |
| `frontend/src/components/billing/quota-summary.tsx` | EVALUATE -- may enhance with progress bars |

## Implementation Steps

### 1. Add portal session hook to billing.ts
```typescript
type PortalSessionResponse = {
  portal_url: string;
  customer_id: string;
};

export const getPortalSession = async (): Promise<PortalSessionResponse> => {
  const response = await customFetch<{ data: PortalSessionResponse; status: number; headers: Headers }>(
    "/api/v1/billing/portal-session",
    { method: "GET" },
  );
  return response.data;
};

export const usePortalSession = () =>
  useMutation({ mutationFn: getPortalSession });
```

### 2. Create billing-settings-section.tsx
Extract from settings page, enhance:

```tsx
// Key sections:
// 1. Plan info row: badge (Trial/Pro) + status text + trial countdown
// 2. Usage meters: iterate quotas, render progress bars with color thresholds
// 3. Actions: "Upgrade to Pro" or "Manage Subscription" (portal link)

function trialDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function usageColor(percentage: number): string {
  if (percentage >= 90) return "bg-rose-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}
```

### 3. Update settings/page.tsx
- Import `BillingSettingsSection`
- Replace inline billing section with `<BillingSettingsSection />`
- Remove billing-related state/hooks from settings page (move to component)
- Settings page should drop well under 200 lines

### 4. Usage meter progress bars
For each quota with a limit, render:
```tsx
<div>
  <div className="flex justify-between text-sm">
    <span>{label}</span>
    <span>{used}/{limit}</span>
  </div>
  <div className="mt-1 h-2 rounded-full bg-slate-100">
    <div
      className={cn("h-full rounded-full transition-all", usageColor(pct))}
      style={{ width: `${Math.min(pct, 100)}%` }}
    />
  </div>
</div>
```

## Todo List
- [ ] Add `getPortalSession` and `usePortalSession` to `billing.ts`
- [ ] Create `billing-settings-section.tsx` component
- [ ] Plan badge with tier label and colored indicator
- [ ] Trial countdown with color-coded days remaining
- [ ] Usage meters with progress bars
- [ ] "Manage subscription" button -> Polar portal
- [ ] "Upgrade to Pro" button -> upgrade modal
- [ ] Extract billing section from `settings/page.tsx`
- [ ] Test: Pro user sees "Manage Subscription" button
- [ ] Test: Trial user sees "Upgrade" button and countdown
- [ ] Test: Portal link opens in new tab
- [ ] Test: Usage meters render correctly with color thresholds

## Success Criteria
- Settings page billing section shows plan status, usage meters, and portal link
- Trial users see days remaining with color-coded urgency
- Pro users can access Polar portal to manage subscription
- Settings page stays under 200 lines after extraction

## Risk Assessment
- **Portal session failure:** Show error toast with retry. Polar API is generally reliable.
- **Stale subscription data:** TanStack Query handles refetch; billing data has `interactive` policy.

## Security Considerations
- Portal session URL is short-lived (Polar generates time-limited URLs)
- Only org members can access billing info (existing auth middleware)
- Portal URL should not be cached or stored client-side

## Next Steps
- Phase 5 (sidebar usage meter) reuses the same quota data

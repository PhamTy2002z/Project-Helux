# Phase 02 -- Rework Upgrade Modal

## Context Links
- Plan: `plan.md`
- Current modal: `frontend/src/components/billing/upgrade-modal.tsx`
- Plan card: `frontend/src/components/billing/plan-card.tsx`
- Billing lib: `frontend/src/lib/billing.ts`
- Entitlements: `backend/app/services/entitlements.py`

## Overview
- **Priority:** P0
- **Status:** done
- **Description:** Current upgrade modal shows trial_7d as a selectable plan alongside Pro. Must show Pro-only with feature highlights and direct Polar checkout.

## Key Insights
- Modal currently renders two `PlanCard` components: `trial_7d` and `pro`
- `isProviderMode` check already exists -- redirects to Polar when `billing_mode === "provider"`
- Since Polar is LIVE, `billing_mode` is always `provider` now
- Simulated checkout code path can remain for dev/test but UI should only show Pro
- `QuotaSummary` component already shows current usage -- keep it

## Requirements
### Functional
- Remove `trial_7d` PlanCard from modal
- Show single Pro plan with feature comparison (what user gets by upgrading)
- Feature list: board groups (1->2), boards (1->3), agents (3->15), tokens (20M trial->200M/mo)
- CTA: "Upgrade to Pro -- $25/month"
- On click: call `createCheckout` -> redirect to Polar
- Keep `QuotaSummary` showing current usage
- Keep error handling for API failures

### Non-Functional
- Modal width can shrink since only 1 plan card (sm:max-w-lg instead of sm:max-w-3xl)
- Clean, focused upgrade pitch -- no choice paralysis

## Architecture
No backend changes. Frontend-only rework of `upgrade-modal.tsx`.

## Related Code Files

| File | Action |
|------|--------|
| `frontend/src/components/billing/upgrade-modal.tsx` | MODIFY -- remove trial card, Pro-only layout |
| `frontend/src/components/billing/plan-card.tsx` | EVALUATE -- may simplify or inline for Pro-only |
| `frontend/src/lib/billing.ts` | NO CHANGE |

## Implementation Steps

### 1. Rework upgrade-modal.tsx
Remove the two-card grid layout. Replace with:

```tsx
// Simplified structure
<Dialog>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Upgrade to Pro</DialogTitle>
      <DialogDescription>
        {reason ?? "Unlock higher limits and more boards."}
      </DialogDescription>
    </DialogHeader>

    {/* Trial expired banner (keep existing) */}

    {/* Feature comparison highlights */}
    <div className="space-y-3">
      <FeatureRow label="Board groups" free="1" pro="2" />
      <FeatureRow label="Boards" free="1" pro="3" />
      <FeatureRow label="Agents" free="3" pro="15" />
      <FeatureRow label="Monthly tokens" free="20M trial" pro="200M" />
      <FeatureRow label="Max tokens/run" free="8k" pro="16k" />
    </div>

    {/* Quota summary (keep existing) */}
    <QuotaSummary ... />

    {/* Error banner (keep existing) */}

    <DialogFooter>
      <Button variant="outline" onClick={close}>Cancel</Button>
      <Button onClick={onCheckout} disabled={isSubmitting}>
        {isSubmitting ? "Redirecting..." : "Upgrade to Pro -- $25/mo"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 2. Simplify checkout logic
- Remove `chosenTier` state -- always `"pro"`
- Remove `selectedTier` logic -- hardcode `"pro"`
- Remove simulated checkout branch from `onCheckout` (or gate behind `isProviderMode` which is always true in prod)
- Keep `createCheckoutMutation` as the only checkout path

### 3. Create FeatureRow helper
Inline or extract a small `FeatureRow` component within the modal file:
```tsx
function FeatureRow({ label, free, pro }: { label: string; free: string; pro: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-slate-400 line-through">{free}</span>
        <span className="font-semibold text-slate-900">{pro}</span>
      </div>
    </div>
  );
}
```

### 4. Clean up props
- Remove `initialTier` prop (always Pro now)
- Keep `source` prop for analytics tracking
- Keep `reason` prop for contextual messaging

## Todo List
- [ ] Rework `upgrade-modal.tsx` to Pro-only layout
- [ ] Remove `trial_7d` PlanCard rendering
- [ ] Add feature comparison rows
- [ ] Simplify checkout to always use `createCheckoutMutation`
- [ ] Remove `initialTier` prop, update all call sites
- [ ] Test: modal opens from sidebar "Upgrade now" button
- [ ] Test: modal opens from settings page "Choose plan" button
- [ ] Test: checkout redirect works from modal
- [ ] Test: error state renders correctly

## Success Criteria
- Modal shows Pro plan only with clear feature comparison
- Single CTA "Upgrade to Pro" redirects to Polar checkout
- No trial_7d option visible
- QuotaSummary still shows current usage context

## Risk Assessment
- **Removing trial option:** Users can still get trial via `/onboarding` Basic flow. No functionality lost.
- **Simulated checkout removal:** Keep code path gated behind `isProviderMode` for dev environments.

## Security Considerations
- Same as current -- checkout via authenticated API, no payment data in frontend.

## Next Steps
- Update `DashboardSidebar.tsx` and `settings/page.tsx` call sites to remove `initialTier` prop

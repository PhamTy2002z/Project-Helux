# Phase 05 -- Sidebar Usage Meter

## Context Links
- Plan: `plan.md`
- Sidebar: `frontend/src/components/organisms/DashboardSidebar.tsx`
- Billing lib: `frontend/src/lib/billing.ts`
- Quota API: `useQuotaUsageApiV1MetricsQuotasGet` from Orval-generated hooks

## Overview
- **Priority:** P1
- **Status:** done
- **Description:** Add compact usage meter in sidebar footer showing primary quota percentage. Click navigates to billing section in Settings.

## Key Insights
- Sidebar already imports `useBillingSubscription` and shows trial-expired banner
- Quota data available via `useQuotaUsageApiV1MetricsQuotasGet` (already used in settings)
- Best metric to show: pick the quota closest to its limit (highest %)
- For trial users: show trial token usage (trial_total_tokens)
- For Pro users: show monthly token usage (org_monthly_tokens)
- Sidebar is ~365 lines -- extract meter into small component to keep under 200

## Requirements
### Functional
- Compact progress bar below the trial-expired banner area
- Shows: "{resource} {used}/{limit}" with color-coded bar
- Green (<70%), yellow (70-90%), red (>90%)
- Click -> navigate to `/settings` (billing section)
- Only show when user is signed in and quota data is available
- Don't show if all quotas are unlimited (no limit)

### Non-Functional
- Minimal footprint -- single progress bar, no tooltip needed
- Fetch quota on same interval as health check (60s) to avoid extra API calls
- Extract into `<SidebarUsageMeter />` component

## Architecture

```
DashboardSidebar footer area
  |
  +-- Trial expired banner (existing)
  +-- SidebarUsageMeter (new)
  |     |
  |     +-- useQuotaUsageApiV1MetricsQuotasGet (shared cache)
  |     +-- Pick highest-% quota with a defined limit
  |     +-- Render compact bar + label
  |     +-- onClick -> router.push("/settings")
  |
  +-- System status indicator (existing)
```

## Related Code Files

| File | Action |
|------|--------|
| `frontend/src/components/billing/sidebar-usage-meter.tsx` | CREATE -- compact usage meter component |
| `frontend/src/components/organisms/DashboardSidebar.tsx` | MODIFY -- import and render SidebarUsageMeter |

## Implementation Steps

### 1. Create sidebar-usage-meter.tsx

```tsx
"use client";

import Link from "next/link";
import { useQuotaUsageApiV1MetricsQuotasGet } from "@/api/generated/metrics/metrics";
import { withQueryPolicy, visibilityAwareInterval } from "@/lib/query-policy";
import { usePageActive } from "@/hooks/usePageActive";
import { cn } from "@/lib/utils";

type Quota = { resource: string; used: number; limit: number | null; remaining: number | null; exceeded: boolean };

const RESOURCE_LABELS: Record<string, string> = {
  trial_total_tokens: "Trial tokens",
  org_monthly_tokens: "Monthly tokens",
  agents_total: "Agents",
  boards: "Boards",
  board_groups: "Board groups",
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function pickPrimaryQuota(quotas: Quota[]): Quota | null {
  // Pick the quota with highest usage percentage that has a defined limit
  let best: Quota | null = null;
  let bestPct = -1;
  for (const q of quotas) {
    if (q.limit == null || q.limit <= 0) continue;
    const pct = q.used / q.limit;
    if (pct > bestPct) {
      bestPct = pct;
      best = q;
    }
  }
  return best;
}

export function SidebarUsageMeter({ enabled }: { enabled: boolean }) {
  const isPageActive = usePageActive();
  const quotaQuery = useQuotaUsageApiV1MetricsQuotasGet({
    query: {
      ...withQueryPolicy("background"),
      enabled,
      refetchInterval: visibilityAwareInterval(60_000, isPageActive),
      retry: false,
    },
  });

  const quotas = quotaQuery.data?.data?.quotas;
  if (!quotas) return null;

  const primary = pickPrimaryQuota(quotas);
  if (!primary || !primary.limit) return null;

  const pct = Math.min((primary.used / primary.limit) * 100, 100);
  const label = RESOURCE_LABELS[primary.resource] ?? primary.resource;
  const barColor = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Link href="/settings" className="block cursor-pointer rounded-lg px-3 py-2 hover:bg-slate-50 transition">
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span>{formatCompact(primary.used)}/{formatCompact(primary.limit)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
```

### 2. Integrate into DashboardSidebar
In `DashboardSidebar.tsx`, add between trial-expired banner and system status:

```tsx
import { SidebarUsageMeter } from "@/components/billing/sidebar-usage-meter";

// In footer area, after trial expired banner:
<SidebarUsageMeter enabled={Boolean(isSignedIn)} />
```

## Todo List
- [ ] Create `frontend/src/components/billing/sidebar-usage-meter.tsx`
- [ ] Import and render in `DashboardSidebar.tsx` footer
- [ ] Test: trial user sees trial token usage bar
- [ ] Test: Pro user sees monthly token usage bar
- [ ] Test: clicking meter navigates to settings
- [ ] Test: color thresholds (green/yellow/red)
- [ ] Test: no meter shown when no quotas have limits

## Success Criteria
- Compact usage meter visible in sidebar footer
- Shows most-constrained quota with color-coded bar
- Click navigates to settings billing section
- No additional API calls (reuses cached quota data)

## Risk Assessment
- **No quota data:** Component returns null gracefully.
- **All unlimited quotas:** Component returns null (no bar shown).

## Security Considerations
- Quota data fetched via authenticated API
- No sensitive data displayed (just usage percentages)

## Next Steps
- Phase 3 (billing page) provides the landing page for the meter click

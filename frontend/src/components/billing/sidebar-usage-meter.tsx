"use client";

import Link from "next/link";
import { useQuotaUsageApiV1MetricsQuotasGet } from "@/api/generated/metrics/metrics";
import { withQueryPolicy, visibilityAwareInterval } from "@/lib/query-policy";
import { usePageActive } from "@/hooks/usePageActive";
import { cn } from "@/lib/utils";
import { QUOTA_RESOURCE_LABELS, formatCompact, usageBarColor } from "./billing-display-helpers";

type Quota = { resource: string; used: number; limit: number | null; remaining: number | null; exceeded: boolean };

function pickPrimaryQuota(quotas: Quota[]): Quota | null {
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
      ...withQueryPolicy("interactive"),
      enabled,
      refetchInterval: visibilityAwareInterval(60_000, isPageActive),
      retry: false,
    },
  });

  const quotas = quotaQuery.data?.data?.quotas;
  if (!quotas) return null;

  const primary = pickPrimaryQuota(quotas as Quota[]);
  if (!primary || !primary.limit) return null;

  const pct = Math.min((primary.used / primary.limit) * 100, 100);
  const label = QUOTA_RESOURCE_LABELS[primary.resource] ?? primary.resource;
  const barColor = usageBarColor(pct);

  return (
    <Link href="/settings" className="block cursor-pointer rounded-lg px-3 py-2 hover:bg-[color:var(--surface-muted)] transition">
      <div className="flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>{formatCompact(primary.used)}/{formatCompact(primary.limit)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[color:var(--surface-strong)]">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

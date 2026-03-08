"use client";

import type { QuotaUsage } from "@/api/generated/model";
import { cn } from "@/lib/utils";

type QuotaSummaryProps = {
  quotas: QuotaUsage[];
  className?: string;
};

const RESOURCE_LABELS: Record<string, string> = {
  board_groups: "Board groups",
  boards: "Boards",
  agents_total: "Agents total",
  agents_per_board: "Agents / board",
  org_daily_tokens: "Org tokens / day",
  agent_daily_tokens: "Agent tokens / day",
  org_monthly_tokens: "Org tokens / month",
  trial_total_tokens: "Trial tokens total",
  max_tokens_per_run: "Tokens / run",
};

const formatValue = (value: number | null | undefined): string =>
  typeof value === "number" ? Intl.NumberFormat("en-US").format(value) : "Unlimited";

export function QuotaSummary({ quotas, className }: QuotaSummaryProps) {
  if (!quotas.length) {
    return null;
  }
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
      <p className="text-sm font-semibold text-slate-900">Quota summary</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {quotas.map((quota) => (
          <div
            key={quota.resource}
            className={cn(
              "rounded-lg border px-3.5 py-2.5",
              quota.exceeded ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50/70",
            )}
          >
            <p className="text-xs text-slate-600">
              {RESOURCE_LABELS[quota.resource] ?? quota.resource}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatValue(quota.used)} / {formatValue(quota.limit)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

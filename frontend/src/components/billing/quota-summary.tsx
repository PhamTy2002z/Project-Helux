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
  agent_daily_cost: "Agent cost / day",
  org_daily_cost: "Org cost / day",
};

const formatValue = (
  value: number | null | undefined,
  resource?: string,
): string => {
  if (typeof value !== "number") return "Unlimited";
  if (resource?.includes("cost")) return `$${value.toFixed(2)}`;
  return Intl.NumberFormat("en-US").format(value);
};

export function QuotaSummary({ quotas, className }: QuotaSummaryProps) {
  if (!quotas.length) {
    return null;
  }
  return (
    <div
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4",
        className,
      )}
    >
      <p className="text-sm font-semibold text-strong">Quota summary</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {quotas.map((quota) => (
          <div
            key={quota.resource}
            className={cn(
              "rounded-lg border px-3.5 py-2.5",
              quota.exceeded
                ? "status-danger"
                : "border-[color:var(--border)] bg-[color:var(--surface-muted)]",
            )}
          >
            <p className="text-xs text-[color:var(--text-muted)]">
              {RESOURCE_LABELS[quota.resource] ?? quota.resource}
            </p>
            <p className="mt-1 text-sm font-semibold text-strong">
              {formatValue(quota.used, quota.resource)} /{" "}
              {formatValue(quota.limit, quota.resource)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

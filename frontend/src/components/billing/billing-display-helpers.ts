/**
 * Shared display helpers for billing/quota UI components.
 * Used by sidebar-usage-meter and billing-settings-section.
 */

/** Human-readable labels for quota resource keys. */
export const QUOTA_RESOURCE_LABELS: Record<string, string> = {
  trial_total_tokens: "Trial tokens",
  org_monthly_tokens: "Monthly tokens",
  agents_total: "Agents",
  boards: "Boards",
  board_groups: "Board groups",
};

/** Format large numbers compactly (e.g. 1500000 -> "2M", 12000 -> "12K"). */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** Return a Tailwind color class based on usage percentage thresholds. */
export function usageBarColor(pct: number): string {
  if (pct >= 90) return "bg-rose-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

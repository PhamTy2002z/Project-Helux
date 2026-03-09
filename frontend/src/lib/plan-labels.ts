import type { BillingPlanTier } from "@/lib/billing";

const PLAN_LABELS: Record<BillingPlanTier, string> = {
  trial_7d: "Basic",
  pro: "Pro",
};

export const planLabelFromTier = (
  tier: BillingPlanTier | null | undefined,
): string | null => {
  if (!tier) {
    return null;
  }
  return PLAN_LABELS[tier] ?? null;
};

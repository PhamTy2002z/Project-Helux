"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BillingPlanTier } from "@/lib/billing";
import { Button } from "@/components/ui/button";

type PlanCardProps = {
  tier: BillingPlanTier;
  selected: boolean;
  disabled?: boolean;
  onSelect: (tier: BillingPlanTier) => void;
};

const PLAN_CONTENT: Record<
  BillingPlanTier,
  { title: string; subtitle: string; bullets: string[]; badge: string }
> = {
  trial_7d: {
    title: "Basic",
    subtitle: "Explore product with strict runtime limits.",
    badge: "Starter",
    bullets: [
      "1 board group, 1 board",
      "3 agents total, 3 agents/board",
      "40k org tokens/day",
      "280k trial tokens total + 4k tokens/run",
    ],
  },
  pro: {
    title: "Pro",
    subtitle: "Run production-lite workflows.",
    badge: "Most used",
    bullets: [
      "1 board group, 3 boards",
      "15 agents total, 5 agents/board",
      "300k org tokens/day",
      "8M org tokens/month + 8k tokens/run",
    ],
  },
};

export function PlanCard({
  tier,
  selected,
  disabled,
  onSelect,
}: PlanCardProps) {
  const content = PLAN_CONTENT[tier];
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        selected
          ? "border-blue-500 bg-blue-50/70"
          : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {content.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">{content.subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
          {content.badge}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {content.bullets.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2 text-sm text-slate-700"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
            {bullet}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant={selected ? "primary" : "outline"}
        className="mt-4 w-full"
        disabled={disabled}
        onClick={() => onSelect(tier)}
      >
        {selected ? "Selected" : "Choose plan"}
      </Button>
    </div>
  );
}

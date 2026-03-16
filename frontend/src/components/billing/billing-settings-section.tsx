"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { useQuotaUsageApiV1MetricsQuotasGet } from "@/api/generated/metrics/metrics";
import { Button } from "@/components/ui/button";
import { useBillingSubscription } from "@/lib/billing";
import { planLabelFromTier } from "@/lib/plan-labels";
import { withQueryPolicy } from "@/lib/query-policy";
import { cn } from "@/lib/utils";
import { QUOTA_RESOURCE_LABELS, formatCompact, usageBarColor } from "./billing-display-helpers";
import { UpgradeModal } from "./upgrade-modal";

/* --- Portal session hook --- */

type PortalSessionResponse = { portal_url: string };

const getPortalSession = async (): Promise<PortalSessionResponse> => {
  const response = await (await import("@/api/mutator")).customFetch<{
    data: PortalSessionResponse;
    status: number;
    headers: Headers;
  }>("/api/v1/billing/portal-session", { method: "GET" });
  return response.data;
};

const usePortalSession = () => useMutation({ mutationFn: getPortalSession });

/* --- Helpers --- */

function trialDaysRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function countdownColor(days: number): string {
  if (days <= 1) return "text-rose-600";
  if (days <= 3) return "text-amber-600";
  return "text-emerald-600";
}

/* --- Component --- */

export function BillingSettingsSection({ isSignedIn }: { isSignedIn: boolean }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const subscriptionQuery = useBillingSubscription(isSignedIn);
  const quotaQuery = useQuotaUsageApiV1MetricsQuotasGet({
    query: { ...withQueryPolicy("interactive"), enabled: isSignedIn, retry: false },
  });
  const portalMutation = usePortalSession();

  const sub = subscriptionQuery.data;
  const tier = sub?.plan_tier ?? null;
  const isTrial = tier === "trial_7d";
  const isPro = tier === "pro";
  const isBlocked = sub?.status === "blocked_for_payment";
  const planLabel = planLabelFromTier(tier) ?? "—";
  const daysLeft = trialDaysRemaining(sub?.trial_expires_at);
  const quotas = quotaQuery.data?.data?.quotas;

  const handleManageSubscription = async () => {
    setPortalError(null);
    try {
      const result = await portalMutation.mutateAsync();
      window.open(result.portal_url, "_blank");
    } catch {
      setPortalError("Unable to open subscription portal. Try again.");
    }
  };

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Plan info row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Billing & usage</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  isPro
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {planLabel}
              </span>
              {isBlocked ? (
                <span className="text-xs font-medium text-rose-600">Runtime blocked</span>
              ) : isTrial && daysLeft !== null ? (
                <span className={cn("text-xs font-medium", countdownColor(daysLeft))}>
                  Trial expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                </span>
              ) : isPro ? (
                <span className="text-xs text-emerald-600">Active</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {isPro ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalMutation.isPending}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {portalMutation.isPending ? "Opening…" : "Manage subscription"}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setUpgradeOpen(true)}>
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>

        {portalError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {portalError}
          </div>
        ) : null}

        {/* Usage meters */}
        {quotas && quotas.length > 0 ? (
          <div className="mt-5 space-y-3">
            {(quotas as Array<{ resource: string; used: number; limit: number | null }>)
              .filter((q) => q.limit != null && q.limit > 0)
              .map((q) => {
                const pct = Math.min((q.used / q.limit!) * 100, 100);
                const label = QUOTA_RESOURCE_LABELS[q.resource] ?? q.resource;
                return (
                  <div key={q.resource}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{label}</span>
                      <span className="text-slate-500">
                        {formatCompact(q.used)}/{formatCompact(q.limit!)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all", usageBarColor(pct))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}
      </section>

      <UpgradeModal
        open={upgradeOpen || isBlocked}
        onOpenChange={(next) => {
          if (!next && isBlocked) return;
          setUpgradeOpen(next);
        }}
        reason={isBlocked ? "Trial expired. Upgrade to continue." : undefined}
        source="settings"
      />
    </>
  );
}

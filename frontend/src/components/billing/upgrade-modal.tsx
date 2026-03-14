"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/mutator";
import {
  getQuotaUsageApiV1MetricsQuotasGetQueryKey,
  useQuotaUsageApiV1MetricsQuotasGet,
} from "@/api/generated/metrics/metrics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BILLING_SUBSCRIPTION_QUERY_KEY,
  type BillingPlanTier,
  createIdempotencyKey,
  useBillingSubscription,
  useCreateCheckout,
  useSimulateCheckout,
  useTrackUpgradeModalOpen,
} from "@/lib/billing";
import { withQueryPolicy } from "@/lib/query-policy";
import { PlanCard } from "./plan-card";
import { QuotaSummary } from "./quota-summary";

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  initialTier?: BillingPlanTier;
  source?: "sidebar" | "settings" | "boards_new" | "agents_new" | "unknown";
};

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  initialTier = "pro",
  source = "unknown",
}: UpgradeModalProps) {
  const queryClient = useQueryClient();
  const [chosenTier, setChosenTier] = useState<BillingPlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subscriptionQuery = useBillingSubscription(open);
  const quotaQuery = useQuotaUsageApiV1MetricsQuotasGet({
    query: {
      ...withQueryPolicy("interactive"),
      enabled: open,
      retry: false,
    },
  });

  const simulateCheckoutMutation = useSimulateCheckout();
  const createCheckoutMutation = useCreateCheckout();
  const trackOpenMutation = useTrackUpgradeModalOpen();
  const wasOpenRef = useRef(false);
  const isProviderMode = subscriptionQuery.data?.billing_mode === "provider";
  const isSubmitting = simulateCheckoutMutation.isPending || createCheckoutMutation.isPending;
  const currentTier = subscriptionQuery.data?.plan_tier ?? null;
  const selectedTier = chosenTier ?? currentTier ?? initialTier;
  const trialExpired = subscriptionQuery.data?.status === "blocked_for_payment";

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      trackOpenMutation.mutate({ source });
    }
    wasOpenRef.current = open;
  }, [open, source, trackOpenMutation]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChosenTier(null);
      setCheckoutError(null);
    }
    onOpenChange(nextOpen);
  };

  const onCheckout = async () => {
    setCheckoutError(null);

    if (isProviderMode) {
      // Real checkout: redirect to payment provider
      try {
        const result = await createCheckoutMutation.mutateAsync({
          plan_tier: selectedTier,
          idempotency_key: createIdempotencyKey(),
        });
        window.location.href = result.checkout_url;
      } catch (error) {
        if (error instanceof ApiError) {
          setCheckoutError(error.message || "Unable to start checkout.");
          return;
        }
        setCheckoutError("Unable to start checkout.");
      }
    } else {
      // Simulated checkout (existing flow)
      try {
        await simulateCheckoutMutation.mutateAsync({
          plan_tier: selectedTier,
          idempotency_key: createIdempotencyKey(),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: BILLING_SUBSCRIPTION_QUERY_KEY }),
          queryClient.invalidateQueries({
            queryKey: getQuotaUsageApiV1MetricsQuotasGetQueryKey(),
          }),
        ]);
        handleOpenChange(false);
      } catch (error) {
        if (error instanceof ApiError) {
          setCheckoutError(error.message || "Unable to unlock plan.");
          return;
        }
        setCheckoutError("Unable to unlock plan.");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl sm:p-7">
        <DialogHeader>
          <DialogTitle>Choose plan</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6 text-slate-600">
            {reason ??
              (isProviderMode
                ? "Choose a plan and proceed to secure checkout."
                : "Unlock subscription in one step. This billing flow is simulated in v1.")}
          </DialogDescription>
        </DialogHeader>

        {trialExpired ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            Trial has expired. Runtime actions are blocked until upgrade.
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <PlanCard
            tier="trial_7d"
            selected={selectedTier === "trial_7d"}
            onSelect={setChosenTier}
            disabled={isSubmitting}
          />
          <PlanCard
            tier="pro"
            selected={selectedTier === "pro"}
            onSelect={setChosenTier}
            disabled={isSubmitting}
          />
        </div>

        {quotaQuery.data?.data.quotas ? (
          <QuotaSummary quotas={quotaQuery.data.data.quotas} className="mt-3" />
        ) : null}

        {checkoutError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {checkoutError}
          </div>
        ) : null}

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onCheckout} disabled={isSubmitting}>
            {isSubmitting
              ? (isProviderMode ? "Redirecting…" : "Unlocking…")
              : (isProviderMode ? "Proceed to checkout" : "Confirm unlock")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

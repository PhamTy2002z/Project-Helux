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
  createIdempotencyKey,
  useBillingSubscription,
  useCreateCheckout,
  useSimulateCheckout,
  useTrackUpgradeModalOpen,
} from "@/lib/billing";
import { withQueryPolicy } from "@/lib/query-policy";
import { QuotaSummary } from "./quota-summary";

/* Feature comparison row (inline helper) */
function FeatureRow({
  label,
  free,
  pro,
}: {
  label: string;
  free: string;
  pro: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-quiet line-through">{free}</span>
        <span className="font-semibold text-strong">{pro}</span>
      </div>
    </div>
  );
}

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  source?: "sidebar" | "settings" | "boards_new" | "agents_new" | "unknown";
};

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
  source = "unknown",
}: UpgradeModalProps) {
  const queryClient = useQueryClient();
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
  const isSubmitting =
    simulateCheckoutMutation.isPending || createCheckoutMutation.isPending;
  const trialExpired = subscriptionQuery.data?.status === "blocked_for_payment";

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      trackOpenMutation.mutate({ source });
    }
    wasOpenRef.current = open;
  }, [open, source, trackOpenMutation]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCheckoutError(null);
    }
    onOpenChange(nextOpen);
  };

  const onCheckout = async () => {
    setCheckoutError(null);

    if (isProviderMode) {
      try {
        const result = await createCheckoutMutation.mutateAsync({
          plan_tier: "pro",
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
      try {
        await simulateCheckoutMutation.mutateAsync({
          plan_tier: "pro",
          idempotency_key: createIdempotencyKey(),
        });
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: BILLING_SUBSCRIPTION_QUERY_KEY,
          }),
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
      <DialogContent className="sm:max-w-lg sm:p-7">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            {reason ?? "Unlock higher limits and more boards."}
          </DialogDescription>
        </DialogHeader>

        {trialExpired ? (
          <div className="status-warning rounded-lg px-4 py-2.5 text-sm">
            Trial has expired. Runtime actions are blocked until upgrade.
          </div>
        ) : null}

        <div className="mt-2 space-y-3">
          <FeatureRow label="Board groups" free="1" pro="2" />
          <FeatureRow label="Boards" free="1" pro="3" />
          <FeatureRow label="Agents" free="3" pro="15" />
          <FeatureRow label="Monthly tokens" free="20M trial" pro="200M" />
          <FeatureRow label="Max tokens/run" free="8k" pro="16k" />
        </div>

        {quotaQuery.data?.data.quotas ? (
          <QuotaSummary quotas={quotaQuery.data.data.quotas} className="mt-3" />
        ) : null}

        {checkoutError ? (
          <div className="status-danger rounded-lg px-4 py-2.5 text-sm">
            {checkoutError}
          </div>
        ) : null}

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onCheckout} disabled={isSubmitting}>
            {isSubmitting
              ? isProviderMode
                ? "Redirecting…"
                : "Unlocking…"
              : "Upgrade to Pro — $25/mo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

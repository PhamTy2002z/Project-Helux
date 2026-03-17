"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { getQuotaUsageApiV1MetricsQuotasGetQueryKey } from "@/api/generated/metrics/metrics";
import { useAuth } from "@/auth/clerk";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Button } from "@/components/ui/button";
import {
  BILLING_SUBSCRIPTION_QUERY_KEY,
  createIdempotencyKey,
  useBillingSubscription,
  useCreateCheckout,
  useSimulateCheckout,
} from "@/lib/billing";

/**
 * Auto-checkout page for Pro plan (public route).
 * Unauthenticated users see sign-in prompt; authenticated users auto-checkout.
 * Simulated mode: instant unlock → redirect to dashboard.
 * Provider mode: redirect to Polar checkout → /checkout/success.
 */
export default function CheckoutProPage() {
  return (
    <QueryProvider>
      <CheckoutProContent />
    </QueryProvider>
  );
}

function CheckoutProContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);

  /* Redirect unauthenticated users to sign-in with return URL */
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in?redirect_url=/checkout/pro");
    }
  }, [isLoaded, isSignedIn, router]);

  const subscriptionQuery = useBillingSubscription(Boolean(isSignedIn));
  const simulateCheckout = useSimulateCheckout();
  const createCheckout = useCreateCheckout();

  const sub = subscriptionQuery.data;
  const isPro = sub?.plan_tier === "pro";
  const isProviderMode = sub?.billing_mode === "provider";

  useEffect(() => {
    if (!sub || triggeredRef.current) return;

    /* Already Pro — skip to dashboard */
    if (isPro) {
      router.replace("/dashboard");
      return;
    }

    triggeredRef.current = true;
    const key = createIdempotencyKey();

    if (isProviderMode) {
      createCheckout
        .mutateAsync({ plan_tier: "pro", idempotency_key: key })
        .then((result) => {
          window.location.href = result.checkout_url;
        })
        .catch(() => setError("Unable to start checkout. Please try again."));
    } else {
      simulateCheckout
        .mutateAsync({ plan_tier: "pro", idempotency_key: key })
        .then(async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: BILLING_SUBSCRIPTION_QUERY_KEY,
            }),
            queryClient.invalidateQueries({
              queryKey: getQuotaUsageApiV1MetricsQuotasGetQueryKey(),
            }),
          ]);
          router.replace("/dashboard?welcome=pro");
        })
        .catch(() => setError("Unable to unlock plan. Please try again."));
    }
  }, [
    sub,
    isPro,
    isProviderMode,
    router,
    queryClient,
    createCheckout,
    simulateCheckout,
  ]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      {error ? (
        <>
          <p className="text-sm text-rose-600">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/settings")}>
              Go to Settings
            </Button>
            <Button
              onClick={() => {
                setError(null);
                triggeredRef.current = false;
              }}
            >
              Try again
            </Button>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-quiet" />
          <p className="text-sm text-muted">Setting up your Pro plan...</p>
        </>
      )}
    </div>
  );
}

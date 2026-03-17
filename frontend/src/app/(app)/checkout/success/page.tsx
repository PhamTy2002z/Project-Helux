"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingSubscription } from "@/lib/billing";

const MAX_POLL_ATTEMPTS = 15;

/**
 * Post-payment landing page. Polls subscription status until Pro activates,
 * then redirects to /dashboard?welcome=pro to show celebration modal.
 */
export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [pollCount, setPollCount] = useState(0);

  const subscriptionQuery = useBillingSubscription(true);
  const isPro = subscriptionQuery.data?.plan_tier === "pro";
  const isTimedOut = !isPro && pollCount >= MAX_POLL_ATTEMPTS;

  /* Redirect to dashboard once Pro is confirmed */
  useEffect(() => {
    if (isPro) {
      router.replace("/dashboard?welcome=pro");
    }
  }, [isPro, router]);

  /* Poll subscription status every 2s until Pro or timeout */
  const { refetch } = subscriptionQuery;
  useEffect(() => {
    if (isPro || pollCount >= MAX_POLL_ATTEMPTS) return;
    const timer = setTimeout(() => {
      refetch();
      setPollCount((c) => c + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isPro, pollCount, refetch]);

  if (isTimedOut) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold text-strong">
          Activation is taking longer than expected
        </h1>
        <p className="max-w-md text-sm text-muted">
          Your payment was successful. Plan activation may take a moment.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      <h1 className="text-xl font-semibold text-strong">Activating your Pro plan…</h1>
      <p className="text-sm text-muted">This usually takes a few seconds.</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBillingSubscription } from "@/lib/billing";

const UNLOCKED_FEATURES = [
  "2 board groups",
  "3 boards",
  "15 agents",
  "200M tokens/month",
  "16k max tokens/run",
];

const MAX_POLL_ATTEMPTS = 15;

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkout_id");
  const [pollCount, setPollCount] = useState(0);

  const subscriptionQuery = useBillingSubscription(true);
  const isPro = subscriptionQuery.data?.plan_tier === "pro";
  const isActivating = !isPro && pollCount < MAX_POLL_ATTEMPTS;
  const isTimedOut = !isPro && pollCount >= MAX_POLL_ATTEMPTS;

  // Poll subscription status until plan activates or timeout
  const { refetch } = subscriptionQuery;
  useEffect(() => {
    if (isPro || pollCount >= MAX_POLL_ATTEMPTS) return;
    const timer = setTimeout(() => {
      refetch();
      setPollCount((c) => c + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isPro, pollCount, refetch]);

  // Activating state
  if (isActivating && !isPro) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <h1 className="text-xl font-semibold text-slate-900">Activating your Pro plan…</h1>
        <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
      </div>
    );
  }

  // Timeout state
  if (isTimedOut) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-semibold text-slate-900">
          Activation is taking longer than expected
        </h1>
        <p className="max-w-md text-sm text-slate-500">
          Your payment was successful. Plan activation may take a moment.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants())}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      {/* CSS confetti animation */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="confetti-piece absolute block h-2 w-2 rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][i % 5],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to Pro!</h1>
        <p className="mt-2 text-sm text-slate-500">Your plan is now active.</p>
      </div>

      <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          What&apos;s unlocked
        </p>
        <ul className="space-y-1.5">
          {UNLOCKED_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Go to Dashboard
        </Link>
        <Link href="/boards" className={cn(buttonVariants({ variant: "outline" }))}>
          Create New Board
        </Link>
      </div>

      {checkoutId ? (
        <p className="text-xs text-slate-400">Ref: {checkoutId}</p>
      ) : null}

      {/* Confetti CSS animation */}
      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          animation: confettiFall 3s ease-in forwards;
        }
      `}</style>
    </div>
  );
}

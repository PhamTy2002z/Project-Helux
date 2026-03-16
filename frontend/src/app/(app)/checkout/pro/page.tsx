"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCheckout, createIdempotencyKey } from "@/lib/billing";

export default function CheckoutProPage() {
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(true);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  useEffect(() => {
    let cancelled = false;

    const startCheckout = async () => {
      try {
        const result = await createCheckout({
          plan_tier: "pro",
          idempotency_key: idempotencyKeyRef.current,
        });
        if (!cancelled) {
          window.location.href = result.checkout_url;
        }
      } catch {
        if (!cancelled) {
          setError("Unable to start checkout. Please try again.");
          setIsRedirecting(false);
        }
      }
    };

    startCheckout();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-rose-600">{error}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      <p className="text-sm text-slate-600">Preparing secure checkout…</p>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/clerk";
import { isOnboardingComplete, useOnboardingProgress } from "@/lib/onboarding";

/**
 * Redirects to /onboarding if the user hasn't completed onboarding.
 * Extracted from DashboardShell to avoid coupling redirect logic with layout rendering.
 */
export function useOnboardingGuard(isOnboardingPath: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  const onboardingQuery = useOnboardingProgress(
    Boolean(isSignedIn) && !isOnboardingPath,
  );
  const onboardingProgress = onboardingQuery.data ?? null;

  useEffect(() => {
    if (!isSignedIn || isOnboardingPath) return;
    if (onboardingQuery.isLoading || onboardingQuery.isError || !onboardingProgress) return;
    if (!isOnboardingComplete(onboardingProgress)) {
      if (pathname.startsWith("/onboarding")) return;
      router.replace("/onboarding");
    }
  }, [
    pathname,
    isOnboardingPath,
    isSignedIn,
    onboardingProgress,
    onboardingQuery.isError,
    onboardingQuery.isLoading,
    router,
  ]);
}

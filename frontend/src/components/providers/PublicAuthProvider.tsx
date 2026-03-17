"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { isLikelyValidClerkPublishableKey } from "@/auth/clerkKey";
import { isLocalAuthMode } from "@/auth/localAuth";

/**
 * Lightweight auth context for public pages (landing, pricing, blog, etc.).
 * Provides ClerkProvider so useAuth() can detect signed-in state,
 * but does NOT gate rendering behind authentication like AuthProvider does.
 */
export function PublicAuthProvider({ children }: { children: ReactNode }) {
  if (isLocalAuthMode()) {
    return <>{children}</>;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!isLikelyValidClerkPublishableKey(publishableKey)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      afterSignOutUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL ?? "/"}
    >
      {children}
    </ClerkProvider>
  );
}

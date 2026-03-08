"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";

import { isLikelyValidClerkPublishableKey } from "@/auth/clerkKey";
import {
  clearLocalAuthToken,
  getLocalAuthToken,
  isLocalAuthMode,
  verifyLocalAuthSession,
} from "@/auth/localAuth";
import { LocalAuthLogin } from "@/components/organisms/LocalAuthLogin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const localMode = isLocalAuthMode();
  const initialLocalAuthenticated = localMode ? Boolean(getLocalAuthToken()) : false;
  const [localAuthReady, setLocalAuthReady] = useState(
    !localMode || !initialLocalAuthenticated,
  );
  const [localAuthenticated, setLocalAuthenticated] = useState(initialLocalAuthenticated);

  useEffect(() => {
    if (localMode) return;
    clearLocalAuthToken();
  }, [localMode]);

  useEffect(() => {
    if (!localMode || localAuthReady || !localAuthenticated) return;
    let active = true;

    void verifyLocalAuthSession().then((authenticated) => {
      if (!active) return;
      setLocalAuthenticated(authenticated);
      setLocalAuthReady(true);
    });

    return () => {
      active = false;
    };
  }, [localAuthReady, localAuthenticated, localMode]);

  if (localMode) {
    if (!localAuthReady) {
      return null;
    }
    if (!localAuthenticated) {
      return (
        <LocalAuthLogin
          onAuthenticated={() => {
            setLocalAuthenticated(true);
            setLocalAuthReady(true);
          }}
        />
      );
    }
    return <>{children}</>;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const afterSignOutUrl =
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL ?? "/";

  if (!isLikelyValidClerkPublishableKey(publishableKey)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={afterSignOutUrl}
    >
      {children}
    </ClerkProvider>
  );
}

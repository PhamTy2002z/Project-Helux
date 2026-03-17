"use client";

// NOTE: We intentionally keep this file very small and dependency-free.
// It provides CI/secretless-build safe fallbacks for Clerk hooks/components.

import type { ReactNode, ComponentProps } from "react";

import {
  ClerkProvider,
  SignInButton as ClerkSignInButton,
  SignOutButton as ClerkSignOutButton,
  useAuth as clerkUseAuth,
  useUser as clerkUseUser,
} from "@clerk/nextjs";

import { isLikelyValidClerkPublishableKey } from "@/auth/clerkKey";
import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";

function hasLocalAuthToken(): boolean {
  return Boolean(getLocalAuthToken());
}

function isMissingClerkProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(
    "can only be used within the <ClerkProvider />",
  );
}

function getSignedOutAuthState() {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: null,
    sessionId: null,
    getToken: async () => null,
  } as const;
}

function getSignedOutUserState() {
  return { isLoaded: true, isSignedIn: false, user: null } as const;
}

export function isClerkEnabled(): boolean {
  // IMPORTANT: keep this in sync with AuthProvider.
  if (isLocalAuthMode()) return false;
  return isLikelyValidClerkPublishableKey(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}

export function SignedIn(props: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.isLoaded || !auth.isSignedIn) return null;
  return <>{props.children}</>;
}

export function SignedOut(props: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.isLoaded || auth.isSignedIn) return null;
  return <>{props.children}</>;
}

// Keep the same prop surface as Clerk components so call sites don't need edits.
export function SignInButton(props: ComponentProps<typeof ClerkSignInButton>) {
  if (!isClerkEnabled()) return null;
  return <ClerkSignInButton {...props} />;
}

export function SignOutButton(
  props: ComponentProps<typeof ClerkSignOutButton>,
) {
  if (!isClerkEnabled()) return null;
  return <ClerkSignOutButton {...props} />;
}

export function useUser() {
  if (isLocalAuthMode()) {
    return {
      isLoaded: true,
      isSignedIn: hasLocalAuthToken(),
      user: null,
    } as const;
  }
  if (!isClerkEnabled()) return getSignedOutUserState();

  try {
    return clerkUseUser();
  } catch (error: unknown) {
    if (isMissingClerkProviderError(error)) return getSignedOutUserState();
    throw error;
  }
}

export function useAuth() {
  if (isLocalAuthMode()) {
    const token = getLocalAuthToken();
    return {
      isLoaded: true,
      isSignedIn: Boolean(token),
      userId: token ? "local-user" : null,
      sessionId: token ? "local-session" : null,
      getToken: async () => token,
    } as const;
  }
  if (!isClerkEnabled()) return getSignedOutAuthState();

  try {
    return clerkUseAuth();
  } catch (error: unknown) {
    if (isMissingClerkProviderError(error)) return getSignedOutAuthState();
    throw error;
  }
}

// Re-export ClerkProvider for places that want to mount it, but strongly prefer
// gating via isClerkEnabled() at call sites.
export { ClerkProvider };

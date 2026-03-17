import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SignedIn, SignedOut, useAuth, useUser } from "@/auth/clerk";

const clerkState = vi.hoisted(() => ({ throwMissingProvider: true }));

vi.mock("@/auth/localAuth", () => ({
  getLocalAuthToken: () => null,
  isLocalAuthMode: () => false,
}));

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignOutButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => {
    if (clerkState.throwMissingProvider) {
      throw new Error(
        "@clerk/nextjs: SignedOut can only be used within the <ClerkProvider /> component.",
      );
    }
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: "user_123",
      sessionId: "sess_123",
      getToken: async () => "token",
    };
  },
  useUser: () => {
    if (clerkState.throwMissingProvider) {
      throw new Error(
        "@clerk/nextjs: SignedOut can only be used within the <ClerkProvider /> component.",
      );
    }
    return {
      isLoaded: true,
      isSignedIn: true,
      user: { id: "user_123" },
    };
  },
}));

function AuthProbe() {
  const auth = useAuth();
  return <div>{auth.isSignedIn ? "auth-signed-in" : "auth-signed-out"}</div>;
}

function UserProbe() {
  const user = useUser();
  return <div>{user.isSignedIn ? "user-signed-in" : "user-signed-out"}</div>;
}

describe("auth/clerk fallbacks", () => {
  const previousClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
      "pk_test_abc123def456ghi789";
    clerkState.throwMissingProvider = true;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousClerkKey;
  });

  it("treats missing ClerkProvider as signed-out instead of crashing", () => {
    render(
      <>
        <SignedOut>
          <span>guest-visible</span>
        </SignedOut>
        <SignedIn>
          <span>member-visible</span>
        </SignedIn>
        <AuthProbe />
        <UserProbe />
      </>,
    );

    expect(screen.getByText("guest-visible")).toBeInTheDocument();
    expect(screen.queryByText("member-visible")).not.toBeInTheDocument();
    expect(screen.getByText("auth-signed-out")).toBeInTheDocument();
    expect(screen.getByText("user-signed-out")).toBeInTheDocument();
  });
});

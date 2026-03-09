"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";
import { resolveSignInRedirectUrl } from "@/auth/redirects";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LocalAuthLogin } from "@/components/organisms/LocalAuthLogin";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const localMode = isLocalAuthMode();

  useEffect(() => {
    if (!localMode) return;
    if (!getLocalAuthToken()) return;
    router.replace("/dashboard");
  }, [localMode, router]);

  if (localMode) {
    return (
      <LocalAuthLogin
        onAuthenticated={() => {
          router.replace("/dashboard");
        }}
      />
    );
  }

  const forceRedirectUrl = resolveSignInRedirectUrl(
    searchParams.get("redirect_url"),
  );

  // Dedicated sign-in route for Cypress E2E.
  // Avoids modal/iframe auth flows and gives Cypress a stable top-level page.
  return (
    <AuthProvider>
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <SignIn
          routing="path"
          path="/sign-in"
          forceRedirectUrl={forceRedirectUrl}
        />
      </main>
    </AuthProvider>
  );
}

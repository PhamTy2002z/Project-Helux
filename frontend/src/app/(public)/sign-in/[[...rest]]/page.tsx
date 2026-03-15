"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";

import { isClerkEnabled } from "@/auth/clerk";
import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";
import { resolveSignInRedirectUrl } from "@/auth/redirects";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LocalAuthLogin } from "@/components/organisms/LocalAuthLogin";

const SIGN_IN_STEPS = [
  "Authenticate with your organization account.",
  "Continue to the exact board or task you requested.",
  "Operate workflows, approvals, and gateways in one place.",
];

const clerkAppearance = {
  layout: {
    logoPlacement: "none",
  },
  variables: {
    colorPrimary: "#FFFFFF",
    colorText: "#F9FAFB",
    colorTextSecondary: "rgba(255,255,255,0.65)",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorInputText: "#F9FAFB",
    colorNeutral: "rgba(255,255,255,0.6)",
    borderRadius: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none",
    card: "border-0 bg-transparent p-0 shadow-none",
    headerTitle: "text-2xl font-semibold tracking-tight text-white",
    headerSubtitle: "text-sm text-white/70",
    socialButtonsBlockButton:
      "h-11 border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]",
    socialButtonsBlockButtonText: "font-medium text-white",
    dividerLine: "bg-white/10",
    dividerText: "text-white/45",
    formFieldLabel: "text-xs font-semibold uppercase tracking-[0.08em] text-white/55",
    formFieldInput:
      "h-11 border-white/15 bg-white/[0.03] text-white placeholder:text-white/40 focus:border-white/40",
    formButtonPrimary:
      "h-11 rounded-xl border border-white/20 bg-white text-sm font-semibold text-black hover:bg-white/90",
    footerActionText: "text-white/60",
    footerActionLink: "font-semibold text-white hover:text-white/80",
    identityPreviewText: "text-white/80",
    identityPreviewEditButton: "text-white/70 hover:text-white",
    formResendCodeLink: "font-semibold text-white hover:text-white/80",
  },
} as const;

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const localMode = isLocalAuthMode();
  const clerkEnabled = isClerkEnabled();

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
      <div className="landing-page relative min-h-screen overflow-x-hidden bg-black text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-[rgba(255,91,53,0.2)] blur-3xl" />
          <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[rgba(56,189,248,0.18)] blur-3xl" />
        </div>

        <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-10">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,460px)] lg:items-center">
            <section className="space-y-6">
              <Link
                href="/"
                prefetch={false}
                className="inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Back to Home
              </Link>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                  FlowGrid
                </p>
                <h1 className="text-balance font-[var(--font-display)] text-4xl leading-tight text-white sm:text-5xl">
                  Sign In and Continue Operating.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                  Access boards, approvals, and gateway activity from one secure command surface.
                </p>
              </div>
              <ul className="space-y-3">
                {SIGN_IN_STEPS.map((step) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-white/75 sm:text-base">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-white/80" aria-hidden="true" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/[0.04] p-4 sm:p-6">
              {clerkEnabled ? (
                <SignIn
                  routing="path"
                  path="/sign-in"
                  forceRedirectUrl={forceRedirectUrl}
                  signUpForceRedirectUrl={forceRedirectUrl}
                  appearance={clerkAppearance}
                />
              ) : (
                <div
                  role="alert"
                  className="rounded-2xl border border-amber-300/35 bg-amber-200/10 p-5 text-sm text-amber-100"
                >
                  <p className="font-semibold text-amber-50">Clerk chưa được cấu hình hợp lệ.</p>
                  <p className="mt-2">
                    Cần set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ở frontend và `CLERK_SECRET_KEY` ở
                    backend rồi restart service.
                  </p>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}

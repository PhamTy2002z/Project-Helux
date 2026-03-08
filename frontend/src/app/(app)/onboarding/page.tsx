"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@/auth/clerk";

import { DashboardShell } from "@/components/templates/DashboardShell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Button } from "@/components/ui/button";
import { useOnboardingProgress, useUpdateOnboardingStep } from "@/lib/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const progressQuery = useOnboardingProgress(Boolean(isSignedIn));
  const updateStepMutation = useUpdateOnboardingStep();
  const [skipError, setSkipError] = useState<string | null>(null);

  const progress = progressQuery.data ?? null;
  const isBusy = progressQuery.isLoading || updateStepMutation.isPending;

  const handleSkipAll = async () => {
    if (!progress) return;
    const shouldSkip = window.confirm(
      "Skip onboarding now? You can resume later from /onboarding.",
    );
    if (!shouldSkip) return;
    setSkipError(null);
    try {
      const pendingSteps = progress.steps.filter((step) => step.status === "pending");
      for (const step of pendingSteps) {
        // Sequential updates keep progress consistent even if one call fails.
        // eslint-disable-next-line no-await-in-loop
        await updateStepMutation.mutateAsync({ step: step.key, action: "skip" });
      }
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof Error) {
        setSkipError(error.message);
        return;
      }
      setSkipError("Unable to skip onboarding.");
    }
  };

  return (
    <DashboardShell>
      <SignedOut>
        <div className="lg:col-span-2 flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Onboarding
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to start the first-value onboarding flow.
            </p>
            <div className="mt-5">
              <SignInButton
                mode="modal"
                forceRedirectUrl="/onboarding"
                signUpForceRedirectUrl="/onboarding"
              >
                <Button size="lg">Sign in</Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="lg:col-span-2 min-h-[70vh] bg-slate-50 p-8">
          <div className="mx-auto w-full max-w-4xl">
            <OnboardingWizard
              progress={progress}
              isLoading={isBusy}
              errorMessage={progressQuery.error?.message ?? null}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => router.push("/dashboard")}
              >
                Go to dashboard
              </Button>
              {!progress?.completed ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-600"
                  disabled={isBusy}
                  onClick={handleSkipAll}
                >
                  Skip onboarding for now
                </Button>
              ) : null}
            </div>
            {skipError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {skipError}
              </div>
            ) : null}
          </div>
        </div>
      </SignedIn>
    </DashboardShell>
  );
}

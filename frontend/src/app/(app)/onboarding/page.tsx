"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@/auth/clerk";

import { DashboardShell } from "@/components/templates/DashboardShell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingProgress, useUpdateOnboardingStep } from "@/lib/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const progressQuery = useOnboardingProgress(Boolean(isSignedIn));
  const updateStepMutation = useUpdateOnboardingStep();
  const [skipError, setSkipError] = useState<string | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  const progress = progressQuery.data ?? null;
  const isBusy = progressQuery.isLoading || updateStepMutation.isPending;

  const handleConfirmSkip = async () => {
    if (!progress) return;
    setShowSkipDialog(false);
    setSkipError(null);
    try {
      const pendingSteps = progress.steps.filter((step) => step.status === "pending");
      for (const step of pendingSteps) {
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
          <div className="w-full max-w-md rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-strong">
              Onboarding
            </h1>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
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
        <div className="lg:col-span-2 bg-app px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[58rem] origin-top flex-col items-center xl:scale-90">
            <div className="mb-6 w-full max-w-4xl">
              <h1 className="text-2xl font-semibold tracking-tight text-strong">
                First-value onboarding
              </h1>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Complete these steps to unlock your full workspace setup.
              </p>
            </div>

            <div className="w-full max-w-4xl">
              <OnboardingWizard
                progress={progress}
                isLoading={isBusy}
                errorMessage={progressQuery.error?.message ?? null}
                onSkipAll={() => setShowSkipDialog(true)}
              />

              {skipError ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {skipError}
                </div>
              ) : null}

              <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Skip onboarding?</DialogTitle>
                    <DialogDescription>
                      You can resume later anytime from the onboarding page.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowSkipDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmSkip}>
                      Skip all
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </SignedIn>
    </DashboardShell>
  );
}

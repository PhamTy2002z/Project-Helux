"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, SkipForward } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  type OnboardingProgress,
  type OnboardingStepKey,
  useTrackOnboardingStepViewed,
  useUpdateOnboardingStep,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type OnboardingWizardProps = {
  progress: OnboardingProgress | null | undefined;
  isLoading?: boolean;
  errorMessage?: string | null;
};

type StepMeta = {
  description: string;
  href: string;
  actionLabel: string;
};

const STEP_META: Record<OnboardingStepKey, StepMeta> = {
  use_case: {
    description: "Define the main mission you want FlowGrid to handle first.",
    href: "/onboarding",
    actionLabel: "Save use case",
  },
  create_first_board: {
    description: "Create the first board to organize your initial workflow and agents.",
    href: "/boards/new",
    actionLabel: "Create first board",
  },
  run_onboarding_chat: {
    description: "Open any board and run onboarding chat to initialize context and goals.",
    href: "/boards",
    actionLabel: "Open boards",
  },
  invite_teammate: {
    description: "Invite one teammate so collaboration and approval flows become real.",
    href: "/invite",
    actionLabel: "Invite teammate",
  },
};

export function OnboardingWizard({
  progress,
  isLoading = false,
  errorMessage = null,
}: OnboardingWizardProps) {
  const updateStepMutation = useUpdateOnboardingStep();
  const trackViewedMutation = useTrackOnboardingStepViewed();
  const lastViewedStepRef = useRef<OnboardingStepKey | null>(null);
  const [useCase, setUseCase] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const activeStep =
    progress?.first_pending_step ??
    progress?.steps.find((step) => step.status === "pending")?.key ??
    "use_case";
  const activeStepState = progress?.steps.find((step) => step.key === activeStep) ?? null;
  const activeMeta = STEP_META[activeStep];

  useEffect(() => {
    const fromMetadata = progress?.steps.find((step) => step.key === "use_case")?.details;
    const existing = typeof fromMetadata?.use_case === "string" ? fromMetadata.use_case : "";
    // Keep local input synchronized with server-backed onboarding metadata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUseCase(existing);
  }, [progress]);

  useEffect(() => {
    if (!activeStep || progress?.completed) return;
    if (lastViewedStepRef.current === activeStep) return;
    lastViewedStepRef.current = activeStep;
    trackViewedMutation.mutate({ step: activeStep });
  }, [activeStep, progress?.completed, trackViewedMutation]);

  const isBusy = isLoading || updateStepMutation.isPending;
  const displayError = localError ?? errorMessage;
  const stepCount = progress?.steps.length ?? 0;
  const completedCount = useMemo(
    () => progress?.steps.filter((step) => step.status !== "pending").length ?? 0,
    [progress?.steps],
  );

  const applyStepAction = async (
    step: OnboardingStepKey,
    action: "complete" | "skip" | "reset",
  ) => {
    setLocalError(null);
    try {
      const details = step === "use_case" ? { use_case: useCase.trim() } : undefined;
      await updateStepMutation.mutateAsync({ step, action, details });
    } catch (error) {
      if (error instanceof Error) {
        setLocalError(error.message);
        return;
      }
      setLocalError("Unable to update onboarding progress.");
    }
  };

  const handleUseCaseComplete = async () => {
    if (!useCase.trim()) {
      setLocalError("Add a short use case before continuing.");
      return;
    }
    await applyStepAction("use_case", "complete");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">First-value onboarding</h1>
          <p className="mt-1 text-sm text-slate-600">
            Finish these steps to unlock the full workspace. You can skip intentionally.
          </p>
        </div>
        <Badge variant={progress?.completed ? "success" : "accent"}>
          {completedCount}/{stepCount || 4} done
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(progress?.steps ?? []).map((step) => {
          const done = step.status !== "pending";
          return (
            <div
              key={step.key}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition",
                step.key === activeStep
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">{STEP_META[step.key].description}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">{activeStepState?.title}</p>
        <p className="mt-1 text-sm text-slate-600">{activeMeta.description}</p>
        {activeStep === "use_case" ? (
          <Textarea
            className="mt-3 min-h-[90px] bg-white"
            placeholder="Example: Ship our first customer-ready support board in one week."
            value={useCase}
            onChange={(event) => setUseCase(event.target.value)}
            disabled={isBusy}
          />
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={activeMeta.href}>
            <Button type="button" variant="outline" disabled={isBusy}>
              {activeMeta.actionLabel}
            </Button>
          </Link>
          <Button
            type="button"
            onClick={() =>
              activeStep === "use_case" ? handleUseCaseComplete() : applyStepAction(activeStep, "complete")
            }
            disabled={isBusy}
          >
            Mark complete
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-slate-600"
            onClick={() => applyStepAction(activeStep, "skip")}
            disabled={isBusy}
          >
            <SkipForward className="h-4 w-4" />
            Skip step
          </Button>
        </div>
      </div>

      {displayError ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {displayError}
        </div>
      ) : null}
    </section>
  );
}

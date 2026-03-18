"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Compass,
  ClipboardEdit,
  Headphones,
  Rocket,
  Settings,
  Target,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type OnboardingProgress,
  type OnboardingStepKey,
  useTrackOnboardingStepViewed,
  useUpdateOnboardingStep,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

type OnboardingWizardProps = {
  progress: OnboardingProgress | null | undefined;
  isLoading?: boolean;
  errorMessage?: string | null;
  onSkipAll?: () => void;
};

type StepConfig = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  icon: React.ElementType;
  mode: "use_case" | "choice" | "text";
  detailKey?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

/* ---------- step config ---------- */

const STEPS: StepConfig[] = [
  {
    key: "use_case",
    title: "Define your use case",
    description: "What's the main mission you want VisgniteAI to handle first?",
    icon: ClipboardEdit,
    mode: "use_case",
  },
  {
    key: "create_first_board",
    title: "Choose your workspace mode",
    description:
      "How do you plan to operate in VisgniteAI during the first week?",
    icon: Compass,
    mode: "choice",
    detailKey: "workspace_mode",
    options: [
      { value: "solo", label: "Solo operator" },
      { value: "small_team", label: "Small team collaboration" },
      { value: "cross_functional", label: "Cross-functional coordination" },
      { value: "exploring", label: "Still exploring" },
    ],
  },
  {
    key: "run_onboarding_chat",
    title: "Set your first success outcome",
    description: "What result do you want to achieve in the next two weeks?",
    icon: Target,
    mode: "text",
    detailKey: "first_outcome",
    placeholder:
      "Example: Launch a stable weekly planning workflow for my team",
  },
  {
    key: "invite_teammate",
    title: "Plan your collaboration timing",
    description: "When do you plan to add collaborators to this workspace?",
    icon: CalendarClock,
    mode: "choice",
    detailKey: "collaboration_timing",
    options: [
      { value: "today", label: "Today" },
      { value: "this_week", label: "This week" },
      { value: "next_week", label: "Next week" },
      { value: "later", label: "Later" },
    ],
  },
];

/* ---------- progress bar ---------- */

function StepProgressBar({
  steps,
  currentIndex,
}: {
  steps: StepConfig[];
  currentIndex: number;
}) {
  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-label={`Step ${currentIndex + 1} of ${steps.length}`}
    >
      {steps.map((step, i) => (
        <div
          key={step.key}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-200",
            i < currentIndex
              ? "bg-blue-500"
              : i === currentIndex
                ? "bg-blue-600"
                : "bg-[color:var(--surface-strong)]/90",
          )}
        />
      ))}
    </div>
  );
}

/* ---------- completion view ---------- */

function OnboardingComplete({
  onGoToDashboard,
}: {
  onGoToDashboard?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50">
        <Check className="h-7 w-7 text-blue-600" />
      </div>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-strong">
        You&apos;re all set!
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[color:var(--text-muted)]">
        Your workspace is fully unlocked. Start building.
      </p>
      {onGoToDashboard ? (
        <Button
          className="mt-7 h-11 rounded-full px-6"
          onClick={onGoToDashboard}
        >
          Go to dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Link href="/dashboard">
          <Button className="mt-7 h-11 rounded-full px-6">
            Go to dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ---------- use case options ---------- */

type UseCaseOption = {
  value: string;
  label: string;
  icon: React.ElementType;
};

const CUSTOM_USE_CASE_VALUE = "custom";

const USE_CASE_OPTIONS: UseCaseOption[] = [
  { value: "customer_support", label: "Customer Support", icon: Headphones },
  {
    value: "workflow_automation",
    label: "Workflow Automation",
    icon: Workflow,
  },
  { value: "ops_management", label: "Ops Management", icon: Settings },
  { value: "rapid_prototyping", label: "Rapid Prototyping", icon: Rocket },
];

/* ---------- step content renderers ---------- */

function UseCaseStepContent({
  selectedValue,
  customValue,
  onSelect,
  onCustomValueChange,
  disabled,
}: {
  selectedValue: string;
  customValue: string;
  onSelect: (v: string) => void;
  onCustomValueChange: (v: string) => void;
  disabled: boolean;
}) {
  const selectedCustom = selectedValue === CUSTOM_USE_CASE_VALUE;

  return (
    <div className="mt-7">
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Choose your use case"
      >
        {USE_CASE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onSelect(option.value)}
              className={cn(
                "flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border px-5 py-6 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                selected
                  ? "border-blue-300 bg-blue-50/70"
                  : "border-[color:var(--border)] bg-[color:var(--surface-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)]",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl border",
                  selected
                    ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-muted",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  "text-base font-medium",
                  selected ? "text-strong" : "text-[color:var(--text)]",
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {selectedCustom ? (
        <div className="mt-4">
          <label
            htmlFor="custom-use-case"
            className="mb-2 block text-sm font-medium text-[color:var(--text)]"
          >
            Your use case
          </label>
          <Input
            id="custom-use-case"
            type="text"
            value={customValue}
            onChange={(event) => onCustomValueChange(event.target.value)}
            disabled={disabled}
            placeholder="Example: Compliance tracking for healthcare operations"
            className="h-11 border-[color:var(--border-strong)] bg-[color:var(--surface)] text-strong"
          />
          <p className="mt-2 text-xs text-muted">
            Keep it short so we can personalize your workspace setup.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function QuestionStepContent({
  step,
  answer,
  onAnswerChange,
  disabled,
}: {
  step: StepConfig;
  answer: string;
  onAnswerChange: (v: string) => void;
  disabled: boolean;
}) {
  const options = step.options ?? [];

  if (step.mode === "choice") {
    return (
      <div className="mt-7" role="radiogroup" aria-label={step.title}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const selected = answer === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onAnswerChange(option.value)}
                className={cn(
                  "min-h-[68px] cursor-pointer rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  selected
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-muted)]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/70 p-4">
      <label
        htmlFor={`onboarding-${step.key}`}
        className="mb-2 block text-sm font-medium text-[color:var(--text)]"
      >
        Your answer
      </label>
      <Input
        id={`onboarding-${step.key}`}
        type="text"
        value={answer}
        onChange={(event) => onAnswerChange(event.target.value)}
        disabled={disabled}
        placeholder={step.placeholder ?? "Type your answer"}
        className="h-11 border-[color:var(--border-strong)] bg-[color:var(--surface)] text-strong"
      />
    </div>
  );
}

/* ---------- main wizard ---------- */

export function OnboardingWizard({
  progress,
  isLoading = false,
  errorMessage = null,
  onSkipAll,
}: OnboardingWizardProps) {
  const updateStepMutation = useUpdateOnboardingStep();
  const trackViewedMutation = useTrackOnboardingStepViewed();
  const trackViewedRef = useRef(trackViewedMutation.mutate);
  const lastViewedStepRef = useRef<OnboardingStepKey | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState("");
  const [customUseCase, setCustomUseCase] = useState("");
  const [stepAnswers, setStepAnswers] = useState<
    Record<Exclude<OnboardingStepKey, "use_case">, string>
  >({
    create_first_board: "",
    run_onboarding_chat: "",
    invite_teammate: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  // Keep ref in sync with latest mutate fn
  useEffect(() => {
    trackViewedRef.current = trackViewedMutation.mutate;
  }, [trackViewedMutation.mutate]);

  // Derive current step index from progress
  const currentStepIndex = useMemo(() => {
    if (!progress || progress.completed) return STEPS.length;
    const pendingKey =
      progress.first_pending_step ??
      progress.steps.find((s) => s.status === "pending")?.key;
    if (!pendingKey) return STEPS.length;
    const idx = STEPS.findIndex((s) => s.key === pendingKey);
    return idx >= 0 ? idx : 0;
  }, [progress]);

  const currentStep = STEPS[currentStepIndex] ?? null;

  // Sync use_case from server
  useEffect(() => {
    const fromMetadata = progress?.steps.find(
      (s) => s.key === "use_case",
    )?.details;
    const modeDetails =
      progress?.steps.find((s) => s.key === "create_first_board")?.details ??
      null;
    const outcomeDetails =
      progress?.steps.find((s) => s.key === "run_onboarding_chat")?.details ??
      null;
    const timingDetails =
      progress?.steps.find((s) => s.key === "invite_teammate")?.details ?? null;
    const existing =
      typeof fromMetadata?.use_case === "string" ? fromMetadata.use_case : "";
    const hasPresetMatch = USE_CASE_OPTIONS.some(
      (option) => option.value === existing,
    );
    const workspaceMode =
      typeof modeDetails?.workspace_mode === "string"
        ? modeDetails.workspace_mode
        : "";
    const firstOutcome =
      typeof outcomeDetails?.first_outcome === "string"
        ? outcomeDetails.first_outcome
        : "";
    const collaborationTiming =
      typeof timingDetails?.collaboration_timing === "string"
        ? timingDetails.collaboration_timing
        : "";

    // Sync local state from server response — intentional cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedUseCase(
      !existing ? "" : hasPresetMatch ? existing : CUSTOM_USE_CASE_VALUE,
    );
    setCustomUseCase(hasPresetMatch ? "" : existing);
    setStepAnswers({
      create_first_board: workspaceMode,
      run_onboarding_chat: firstOutcome,
      invite_teammate: collaborationTiming,
    });
  }, [progress]);

  // Track viewed step — use ref for mutate to avoid effect re-runs
  useEffect(() => {
    if (!currentStep || progress?.completed) return;
    if (lastViewedStepRef.current === currentStep.key) return;
    lastViewedStepRef.current = currentStep.key;
    trackViewedRef.current({ step: currentStep.key });
  }, [currentStep, progress?.completed]);

  const isBusy = isLoading || updateStepMutation.isPending;
  const displayError = localError ?? errorMessage;

  const completedCount = useMemo(
    () => progress?.steps.filter((s) => s.status !== "pending").length ?? 0,
    [progress?.steps],
  );

  const applyAction = async (
    step: OnboardingStepKey,
    action: "complete" | "skip" | "reset",
  ) => {
    setLocalError(null);
    try {
      const serializedUseCase =
        selectedUseCase === CUSTOM_USE_CASE_VALUE
          ? customUseCase.trim()
          : selectedUseCase;
      const stepConfig = STEPS.find((s) => s.key === step);
      const detailValue =
        step !== "use_case"
          ? stepAnswers[step as Exclude<OnboardingStepKey, "use_case">].trim()
          : "";
      const details =
        step === "use_case"
          ? { use_case: serializedUseCase }
          : stepConfig?.detailKey && detailValue
            ? { [stepConfig.detailKey]: detailValue }
            : undefined;
      await updateStepMutation.mutateAsync({ step, action, details });
    } catch (error) {
      if (error instanceof Error) {
        setLocalError(error.message);
        return;
      }
      setLocalError("Unable to update onboarding progress.");
    }
  };

  const handleContinue = async () => {
    if (!currentStep) return;
    if (currentStep.key === "use_case" && !selectedUseCase) {
      setLocalError("Pick a use case to continue.");
      return;
    }
    if (
      currentStep.key === "use_case" &&
      selectedUseCase === CUSTOM_USE_CASE_VALUE &&
      customUseCase.trim().length < 3
    ) {
      setLocalError("Describe your use case to continue.");
      return;
    }
    if (currentStep.key !== "use_case") {
      const answer = stepAnswers[currentStep.key].trim();
      if (!answer) {
        setLocalError("Answer this question to continue.");
        return;
      }
      if (currentStep.mode === "text" && answer.length < 5) {
        setLocalError("Add a bit more detail to continue.");
        return;
      }
    }
    await applyAction(currentStep.key, "complete");
  };

  // Completed state
  if (progress?.completed || currentStepIndex >= STEPS.length) {
    return (
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_20px_45px_-32px_rgba(15,23,42,0.45)]">
        <OnboardingComplete />
      </section>
    );
  }

  if (!currentStep) return null;

  const StepIcon = currentStep.icon;

  return (
    <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_20px_45px_-32px_rgba(15,23,42,0.45)]">
      {/* Header with progress */}
      <div className="border-b border-[color:var(--border)] px-8 pt-8 pb-7">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[color:var(--text-muted)]">
            Step {currentStepIndex + 1} of {STEPS.length}
          </p>
          <p className="text-xs text-muted">
            {completedCount}/{STEPS.length} done
          </p>
        </div>
        <div className="mt-4">
          <StepProgressBar steps={STEPS} currentIndex={currentStepIndex} />
        </div>
      </div>

      {/* Step content */}
      <div className="px-8 py-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <StepIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-strong">
                  {currentStep.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                  {currentStep.description}
                </p>
              </div>

              {currentStep.key === "use_case" ? (
                <button
                  type="button"
                  disabled={isBusy}
                  aria-pressed={selectedUseCase === CUSTOM_USE_CASE_VALUE}
                  onClick={() => {
                    setSelectedUseCase(CUSTOM_USE_CASE_VALUE);
                    setLocalError(null);
                  }}
                  className={cn(
                    "min-h-[44px] shrink-0 cursor-pointer rounded-full border px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    selectedUseCase === CUSTOM_USE_CASE_VALUE
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-strong",
                    isBusy && "cursor-not-allowed opacity-60",
                  )}
                >
                  Other (custom)
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Dynamic content per step */}
        {currentStep.key === "use_case" ? (
          <UseCaseStepContent
            selectedValue={selectedUseCase}
            customValue={customUseCase}
            onSelect={(v) => {
              setSelectedUseCase(v);
              if (v !== CUSTOM_USE_CASE_VALUE) {
                setCustomUseCase("");
              }
              setLocalError(null);
            }}
            onCustomValueChange={(v) => {
              setCustomUseCase(v);
              setLocalError(null);
            }}
            disabled={isBusy}
          />
        ) : (
          <QuestionStepContent
            step={currentStep}
            answer={stepAnswers[currentStep.key]}
            onAnswerChange={(value) => {
              setStepAnswers((prev) => ({
                ...prev,
                [currentStep.key]: value,
              }));
              setLocalError(null);
            }}
            disabled={isBusy}
          />
        )}

        {/* Error message */}
        {displayError ? (
          <div className="mt-4 status-danger rounded-lg px-3 py-2 text-sm">
            {displayError}
          </div>
        ) : null}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--surface-muted)]/70 px-8 py-5">
        <Button
          onClick={handleContinue}
          disabled={isBusy}
          className="h-11 cursor-pointer rounded-full px-6"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="min-h-[44px] cursor-pointer rounded-full px-1 text-sm text-muted transition-colors duration-200 hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => applyAction(currentStep.key, "skip")}
            disabled={isBusy}
          >
            Skip this step
          </button>
          {onSkipAll ? (
            <>
              <span className="text-quiet">|</span>
              <button
                type="button"
                className="min-h-[44px] cursor-pointer rounded-full px-1 text-sm text-muted transition-colors duration-200 hover:text-[color:var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={onSkipAll}
                disabled={isBusy}
              >
                Skip all
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

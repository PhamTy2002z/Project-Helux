"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type OnboardingProgress, type OnboardingStepKey } from "@/lib/onboarding";

type GettingStartedChecklistProps = {
  progress: OnboardingProgress | null | undefined;
};

const STEP_LINKS: Record<OnboardingStepKey, string> = {
  use_case: "/onboarding",
  create_first_board: "/boards/new",
  run_onboarding_chat: "/boards",
  invite_teammate: "/invite",
};

export function GettingStartedChecklist({ progress }: GettingStartedChecklistProps) {
  if (!progress) {
    return null;
  }

  const completed = progress.steps.filter((step) => step.status !== "pending").length;
  if (progress.completed) {
    return (
      <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Onboarding complete</p>
            <p className="mt-1 text-sm text-emerald-700">
              All modules are unlocked for this workspace.
            </p>
          </div>
          <Badge variant="success">100%</Badge>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-900">Getting started checklist</p>
          <p className="mt-1 text-sm text-blue-800">
            Complete onboarding to unlock full navigation and reduce setup mistakes.
          </p>
        </div>
        <Badge variant="accent">{completed}/{progress.steps.length}</Badge>
      </div>
      <div className="mt-3 space-y-2">
        {progress.steps.map((step) => (
          <Link
            key={step.key}
            href={STEP_LINKS[step.key]}
            className="flex items-center justify-between rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm transition hover:border-blue-200"
          >
            <span className="inline-flex items-center gap-2 text-slate-800">
              {step.status === "pending" ? (
                <Circle className="h-4 w-4 text-slate-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              {step.title}
            </span>
            <span className="text-xs text-slate-500">
              {step.status === "pending" ? "Pending" : step.status}
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-3">
        <Link href="/onboarding">
          <Button size="sm">Continue onboarding</Button>
        </Link>
      </div>
    </section>
  );
}

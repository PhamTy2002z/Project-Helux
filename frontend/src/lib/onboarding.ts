import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { customFetch } from "@/api/mutator";
import { withQueryPolicy } from "@/lib/query-policy";

export type OnboardingStepKey =
  | "use_case"
  | "create_first_board"
  | "run_onboarding_chat"
  | "invite_teammate";

export type OnboardingStepStatus = "pending" | "completed" | "skipped";

export type OnboardingStepState = {
  key: OnboardingStepKey;
  title: string;
  status: OnboardingStepStatus;
  completed_at: string | null;
  skipped_at: string | null;
  details: Record<string, unknown> | null;
};

export type OnboardingProgress = {
  organization_id: string;
  user_id: string;
  completed: boolean;
  completion_pct: number;
  first_pending_step: OnboardingStepKey | null;
  steps: OnboardingStepState[];
};

type OnboardingProgressResponse = {
  data: OnboardingProgress;
  status: number;
  headers: Headers;
};

type UpdateStepAction = "complete" | "skip" | "reset";

type UpdateOnboardingStepPayload = {
  step: OnboardingStepKey;
  action: UpdateStepAction;
  details?: Record<string, unknown>;
};

type StepViewedPayload = {
  step: OnboardingStepKey;
};

export const ONBOARDING_PROGRESS_QUERY_KEY = [
  "/api/v1/onboarding/progress/me",
] as const;

export const getOnboardingProgress = async (): Promise<OnboardingProgress> => {
  const response = await customFetch<OnboardingProgressResponse>(
    "/api/v1/onboarding/progress/me",
    { method: "GET" },
  );
  return response.data;
};

export const updateOnboardingStep = async (
  payload: UpdateOnboardingStepPayload,
): Promise<OnboardingProgress> => {
  const response = await customFetch<OnboardingProgressResponse>(
    "/api/v1/onboarding/progress/me/steps",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const trackOnboardingStepViewed = async (
  payload: StepViewedPayload,
): Promise<void> => {
  await customFetch<{
    data: { ok: boolean };
    status: number;
    headers: Headers;
  }>("/api/v1/onboarding/progress/me/events/viewed", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const useOnboardingProgress = (enabled: boolean) =>
  useQuery({
    ...withQueryPolicy("interactive"),
    queryKey: ONBOARDING_PROGRESS_QUERY_KEY,
    queryFn: getOnboardingProgress,
    enabled,
    retry: false,
  });

export const useUpdateOnboardingStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOnboardingStep,
    onSuccess: (progress) => {
      queryClient.setQueryData(ONBOARDING_PROGRESS_QUERY_KEY, progress);
    },
  });
};

export const useTrackOnboardingStepViewed = () =>
  useMutation({
    mutationFn: trackOnboardingStepViewed,
  });

export function isOnboardingComplete(
  progress: OnboardingProgress | null | undefined,
): boolean {
  return Boolean(progress?.completed);
}

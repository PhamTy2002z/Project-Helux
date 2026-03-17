"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError, customFetch } from "@/api/mutator";
import { withQueryPolicy } from "@/lib/query-policy";

export type BillingPlanTier = "trial_7d" | "pro";
export type BillingSubscriptionStatus = "active" | "blocked_for_payment";

export type BillingSubscription = {
  organization_id: string;
  plan_tier: BillingPlanTier;
  status: BillingSubscriptionStatus;
  effective_from: string;
  effective_until: string | null;
  trial_expires_at: string | null;
  billing_mode: string;
  payment_provider: string;
};

type BillingSubscriptionResponse = {
  data: BillingSubscription;
  status: number;
  headers: Headers;
};

type SimulateCheckoutPayload = {
  plan_tier: BillingPlanTier;
  idempotency_key: string;
};

type SimulateCheckoutResponse = {
  data: {
    checkout_id: string;
    idempotent_replay: boolean;
    subscription: BillingSubscription;
  };
  status: number;
  headers: Headers;
};

type UpgradeModalOpenPayload = {
  source: "sidebar" | "settings" | "boards_new" | "agents_new" | "unknown";
};

export const BILLING_SUBSCRIPTION_QUERY_KEY = [
  "/api/v1/billing/me/subscription",
] as const;
export const BILLING_HISTORY_QUERY_KEY = [
  "/api/v1/billing/me/history",
] as const;

export type BillingHistoryRow = {
  id: string;
  plan_tier: string;
  amount: string;
  status: string;
  created_at: string;
};

type BillingHistoryResponse = {
  data: BillingHistoryRow[];
  status: number;
  headers: Headers;
};

export const getBillingHistory = async (): Promise<BillingHistoryRow[]> => {
  const response = await customFetch<BillingHistoryResponse>(
    "/api/v1/billing/me/history",
    { method: "GET" },
  );
  return response.data;
};

export const useBillingHistory = (enabled: boolean) =>
  useQuery({
    ...withQueryPolicy("interactive"),
    queryKey: BILLING_HISTORY_QUERY_KEY,
    queryFn: getBillingHistory,
    enabled,
    retry: false,
  });

export const getBillingSubscription =
  async (): Promise<BillingSubscription> => {
    const response = await customFetch<BillingSubscriptionResponse>(
      "/api/v1/billing/me/subscription",
      { method: "GET" },
    );
    return response.data;
  };

export const simulateCheckout = async (
  payload: SimulateCheckoutPayload,
): Promise<SimulateCheckoutResponse["data"]> => {
  const response = await customFetch<SimulateCheckoutResponse>(
    "/api/v1/billing/simulate/checkout",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const trackUpgradeModalOpen = async (
  payload: UpgradeModalOpenPayload,
): Promise<void> => {
  await customFetch<{
    data: { ok: boolean };
    status: number;
    headers: Headers;
  }>("/api/v1/billing/events/upgrade-modal-open", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const useBillingSubscription = (enabled: boolean) =>
  useQuery({
    ...withQueryPolicy("interactive"),
    queryKey: BILLING_SUBSCRIPTION_QUERY_KEY,
    queryFn: getBillingSubscription,
    enabled,
    retry: false,
  });

export const useSimulateCheckout = () =>
  useMutation({
    mutationFn: simulateCheckout,
  });

export const useTrackUpgradeModalOpen = () =>
  useMutation({
    mutationFn: trackUpgradeModalOpen,
  });

// --- Real checkout (provider mode) ---

type CheckoutPayload = {
  plan_tier: BillingPlanTier;
  idempotency_key: string;
};

type CheckoutResponse = {
  checkout_url: string;
  checkout_id: string;
  provider: string;
};

type CheckoutApiResponse = {
  data: CheckoutResponse;
  status: number;
  headers: Headers;
};

export const createCheckout = async (
  payload: CheckoutPayload,
): Promise<CheckoutResponse> => {
  const response = await customFetch<CheckoutApiResponse>(
    "/api/v1/billing/checkout",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const useCreateCheckout = () =>
  useMutation({
    mutationFn: createCheckout,
  });

// --- Helpers ---

export const createIdempotencyKey = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}`;
};

type BillingApiErrorDetail = {
  code: string | null;
  message: string | null;
  resource: string | null;
  plan: string | null;
  used: number | null;
  limit: number | null;
  effectiveUntil: string | null;
};

const QUOTA_RESOURCE_LABELS: Record<string, string> = {
  board_groups: "board groups",
  boards: "boards",
  agents_total: "total agents",
  agents_per_board: "agents per board",
  tasks_created_monthly: "monthly tasks",
  org_daily_tokens: "daily org tokens",
  agent_daily_tokens: "daily agent tokens",
  org_monthly_tokens: "monthly org tokens",
  trial_total_tokens: "trial total tokens",
  max_tokens_per_run: "tokens per run",
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const toNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const getApiErrorDetail = (
  error: unknown,
): BillingApiErrorDetail | null => {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const data = error.data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const detail = (data as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object") {
    return null;
  }
  const typedDetail = detail as {
    code?: unknown;
    message?: unknown;
    resource?: unknown;
    plan?: unknown;
    used?: unknown;
    limit?: unknown;
    effective_until?: unknown;
  };
  return {
    code: toStringOrNull(typedDetail.code),
    message: toStringOrNull(typedDetail.message),
    resource: toStringOrNull(typedDetail.resource),
    plan: toStringOrNull(typedDetail.plan),
    used: toNumberOrNull(typedDetail.used),
    limit: toNumberOrNull(typedDetail.limit),
    effectiveUntil: toStringOrNull(typedDetail.effective_until),
  };
};

export const getApiErrorCode = (error: unknown): string | null =>
  getApiErrorDetail(error)?.code ?? null;

const formatLimit = (value: number): string =>
  Intl.NumberFormat("en-US").format(value);

export const getUpgradeReasonFromError = (
  error: unknown,
  fallbackReason: string,
): string => {
  const detail = getApiErrorDetail(error);
  if (!detail?.code) {
    return fallbackReason;
  }
  if (detail.code === "blocked_for_payment") {
    return "Trial period has ended. Runtime actions are blocked until upgrade.";
  }
  if (detail.code !== "quota_exceeded") {
    return fallbackReason;
  }

  const resource =
    (detail.resource && QUOTA_RESOURCE_LABELS[detail.resource]) ||
    detail.resource?.replace(/_/g, " ") ||
    "current";

  if (detail.used !== null && detail.limit !== null) {
    return `You've reached the ${resource} limit for your current plan (${formatLimit(detail.used)}/${formatLimit(detail.limit)}). Upgrade to continue.`;
  }
  if (detail.limit !== null) {
    return `You've reached the ${resource} limit for your current plan (limit ${formatLimit(detail.limit)}). Upgrade to continue.`;
  }
  return `You've reached the ${resource} limit for your current plan. Upgrade to continue.`;
};

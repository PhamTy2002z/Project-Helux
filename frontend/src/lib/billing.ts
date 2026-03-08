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

export const BILLING_SUBSCRIPTION_QUERY_KEY = ["/api/v1/billing/me/subscription"] as const;

export const getBillingSubscription = async (): Promise<BillingSubscription> => {
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
  await customFetch<{ data: { ok: boolean }; status: number; headers: Headers }>(
    "/api/v1/billing/events/upgrade-modal-open",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
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

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}`;
};

export const getApiErrorCode = (error: unknown): string | null => {
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
  const code = (detail as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

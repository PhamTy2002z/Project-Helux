"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Filter,
  Search,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getQuotaUsageApiV1MetricsQuotasGetQueryKey } from "@/api/generated/metrics/metrics";
import { Button } from "@/components/ui/button";
import {
  BILLING_SUBSCRIPTION_QUERY_KEY,
  BILLING_HISTORY_QUERY_KEY,
  createIdempotencyKey,
  useBillingHistory,
  useBillingSubscription,
  useCreateCheckout,
  useSimulateCheckout,
} from "@/lib/billing";
import type {
  BillingHistoryRow as ApiBillingHistoryRow,
  BillingPlanTier,
} from "@/lib/billing";
import { planLabelFromTier } from "@/lib/plan-labels";
import { cn } from "@/lib/utils";

type PortalSessionResponse = { portal_url: string };

type HistoryStatus = "all" | "succeeded" | "pending" | "failed";

const getPortalSession = async (): Promise<PortalSessionResponse> => {
  const response = await (
    await import("@/api/mutator")
  ).customFetch<{
    data: PortalSessionResponse;
    status: number;
    headers: Headers;
  }>("/api/v1/billing/portal-session", { method: "GET" });
  return response.data;
};

const usePortalSession = () => useMutation({ mutationFn: getPortalSession });

const formatIsoDate = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function trialDaysRemaining(
  expiresAt: string | null | undefined,
): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function countdownColor(days: number): string {
  if (days <= 1) return "text-rose-600";
  if (days <= 3) return "text-amber-600";
  return "text-emerald-600";
}

type PlanCardProps = {
  title: string;
  badge: string;
  price: string;
  unit: string;
  features: string[];
  onAction: () => void;
  actionLabel: string;
  actionDisabled?: boolean;
  cardVariant?: "default" | "featured";
};

function PlanCard({
  title,
  badge,
  price,
  unit,
  features,
  onAction,
  actionLabel,
  actionDisabled = false,
  cardVariant = "default",
}: PlanCardProps) {
  const featured = cardVariant === "featured";

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border p-6 transition-shadow",
        featured
          ? "border-slate-800 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 shadow-lg shadow-slate-900/20 ring-1 ring-slate-700"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-strong hover:shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            featured
              ? "bg-orange-500/90 text-white"
              : "bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]",
          )}
        >
          {badge}
        </span>
      </div>

      <div className="mt-5">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        <span
          className={cn(
            "ml-1 text-sm font-normal",
            featured ? "text-slate-400" : "text-muted",
          )}
        >
          {unit !== "per month" ? unit : "/mo"}
        </span>
      </div>

      <div
        className={cn(
          "my-5 h-px",
          featured ? "bg-slate-700" : "bg-[color:var(--border)]",
        )}
      />

      <ul className="flex-1 space-y-3">
        {features.map((feature) => (
          <li
            key={feature}
            className={cn(
              "flex items-start gap-2.5 text-sm leading-snug",
              featured ? "text-slate-300" : "text-[color:var(--text-muted)]",
            )}
          >
            <CheckCircle2
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                featured ? "text-emerald-400" : "text-quiet",
              )}
            />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant={featured ? "secondary" : "outline"}
        className={cn(
          "mt-6 w-full",
          featured
            ? "bg-white text-slate-900 hover:bg-slate-100"
            : "border-[color:var(--border)] hover:border-[color:var(--border-strong)]",
        )}
        onClick={onAction}
        disabled={actionDisabled}
      >
        {actionLabel}
      </Button>
    </article>
  );
}

const STATUS_LABELS: Record<string, string> = {
  succeeded: "Success",
  pending: "Pending",
  failed: "Failed",
};

const STATUS_STYLES: Record<string, string> = {
  succeeded: "status-badge-success",
  pending: "status-badge-warning",
  failed: "status-badge-danger",
};

export function BillingSettingsSection({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const queryClient = useQueryClient();
  const [portalError, setPortalError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>("all");

  const subscriptionQuery = useBillingSubscription(isSignedIn);
  const historyQuery = useBillingHistory(isSignedIn);
  const portalMutation = usePortalSession();
  const simulateCheckout = useSimulateCheckout();
  const createCheckout = useCreateCheckout();

  const sub = subscriptionQuery.data;
  const tier = sub?.plan_tier ?? null;
  const isTrial = tier === "trial_7d";
  const isPro = tier === "pro";
  const isBlocked = sub?.status === "blocked_for_payment";
  const canOpenPortal = sub?.billing_mode === "provider";
  const isProviderMode = sub?.billing_mode === "provider";
  const daysLeft = trialDaysRemaining(sub?.trial_expires_at);
  const isCheckingOut = simulateCheckout.isPending || createCheckout.isPending;

  const historyRows = historyQuery.data ?? [];

  const filteredHistory = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return historyRows.filter((row: ApiBillingHistoryRow) => {
      const statusMatch =
        historyStatus === "all" || row.status === historyStatus;
      if (!statusMatch) return false;
      if (!keyword) return true;
      const rowContent =
        `${row.plan_tier} ${row.amount} ${row.created_at}`.toLowerCase();
      return rowContent.includes(keyword);
    });
  }, [historyRows, historySearch, historyStatus]);

  const handleManageSubscription = async () => {
    setPortalError(null);
    if (!canOpenPortal) {
      return;
    }
    try {
      const result = await portalMutation.mutateAsync();
      window.open(result.portal_url, "_blank", "noopener,noreferrer");
    } catch {
      setPortalError("Unable to open subscription portal. Try again.");
    }
  };

  const handleUpgrade = async () => {
    setCheckoutError(null);
    const key = createIdempotencyKey();
    if (isProviderMode) {
      try {
        const result = await createCheckout.mutateAsync({
          plan_tier: "pro",
          idempotency_key: key,
        });
        window.location.href = result.checkout_url;
      } catch {
        setCheckoutError("Unable to start checkout. Try again.");
      }
    } else {
      try {
        await simulateCheckout.mutateAsync({
          plan_tier: "pro",
          idempotency_key: key,
        });
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: BILLING_SUBSCRIPTION_QUERY_KEY,
          }),
          queryClient.invalidateQueries({
            queryKey: BILLING_HISTORY_QUERY_KEY,
          }),
          queryClient.invalidateQueries({
            queryKey: getQuotaUsageApiV1MetricsQuotasGetQueryKey(),
          }),
        ]);
      } catch {
        setCheckoutError("Unable to unlock plan. Try again.");
      }
    }
  };

  const handleExportHistory = () => {
    if (filteredHistory.length === 0) return;
    const csvRows = [
      ["Plan", "Amount", "Date", "Status"],
      ...filteredHistory.map((row: ApiBillingHistoryRow) => [
        planLabelFromTier(row.plan_tier as BillingPlanTier) ?? row.plan_tier,
        row.amount,
        formatIsoDate(row.created_at),
        STATUS_LABELS[row.status] ?? row.status,
      ]),
    ];
    const csv = csvRows
      .map((columns) =>
        columns
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "visgniteai-billing-history.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-strong">Plans</h2>
            <p className="mt-1 text-sm text-muted">
              Choose the plan that fits your team.
            </p>
            {isBlocked || (isTrial && daysLeft !== null) ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isBlocked ? (
                  <span className="text-xs font-medium text-rose-600">
                    Runtime blocked until upgrade
                  </span>
                ) : null}
                {isTrial && daysLeft !== null ? (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      countdownColor(daysLeft),
                    )}
                  >
                    Trial expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="inline-flex items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-1">
            <button
              type="button"
              className="rounded-full bg-[color:var(--surface)] px-4 py-1.5 text-sm font-medium text-strong shadow-sm"
            >
              Monthly
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="cursor-not-allowed rounded-full px-4 py-1.5 text-sm font-medium text-quiet"
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <PlanCard
            title="Starter Plan"
            badge="Free"
            price="$0.00"
            unit="per month"
            features={[
              "No credit card required",
              "1 board group, 1 board",
              "3 agents total, 3 agents / board",
              "20M trial tokens, 5M agent tokens / day",
              "8k max tokens / run",
            ]}
            onAction={() => undefined}
            actionLabel={isPro ? "Starter plan" : "Current plan"}
            actionDisabled={true}
          />

          <PlanCard
            title="Growth Plan"
            badge="Pro"
            price="$25.00"
            unit="per month"
            features={[
              "2 board groups, 3 boards",
              "15 agents total, 5 agents / board",
              "20M agent tokens / day",
              "200M org tokens / month, 16k max tokens / run",
            ]}
            onAction={isPro ? () => undefined : handleUpgrade}
            actionLabel={
              isPro
                ? "Current plan"
                : isCheckingOut
                  ? "Processing..."
                  : "Upgrade plan"
            }
            actionDisabled={isPro || isCheckingOut}
            cardVariant="featured"
          />

          <PlanCard
            title="Enterprise Plan"
            badge="Advanced"
            price="Custom"
            unit="per month"
            features={[
              "Higher model and token limits",
              "Priority access to new platform features",
              "Dedicated onboarding assistance",
            ]}
            onAction={() => {
              window.location.href =
                "mailto:sales@visgnite.com?subject=VisgniteAI%20Enterprise%20Plan";
            }}
            actionLabel="Contact us"
          />
        </div>

        {checkoutError ? (
          <div className="status-danger rounded-lg px-4 py-2.5 text-sm">
            {checkoutError}
          </div>
        ) : null}

        {portalError ? (
          <div className="status-danger rounded-lg px-4 py-2.5 text-sm">
            {portalError}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-lg font-semibold text-strong">Billing History</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-quiet" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search..."
                className="h-9 w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-9 pr-3 text-sm text-[color:var(--text)] placeholder:text-quiet focus:outline-none"
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-quiet" />
              <select
                value={historyStatus}
                onChange={(event) =>
                  setHistoryStatus(event.target.value as HistoryStatus)
                }
                className="h-9 min-w-[140px] rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface)] pl-9 pr-8 text-sm text-[color:var(--text)] focus:outline-none"
              >
                <option value="all">All status</option>
                <option value="succeeded">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={handleExportHistory}
              disabled={filteredHistory.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 font-medium">Plan</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {filteredHistory.map((row: ApiBillingHistoryRow) => (
                <tr key={row.id} className="text-[color:var(--text)]">
                  <td className="px-3 py-3.5 font-medium text-strong">
                    {planLabelFromTier(row.plan_tier as BillingPlanTier) ??
                      row.plan_tier}
                  </td>
                  <td className="px-3 py-3.5">{row.amount}</td>
                  <td className="px-3 py-3.5">
                    {formatIsoDate(row.created_at)}
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        STATUS_STYLES[row.status] ?? "status-badge-neutral",
                      )}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] text-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]"
                      aria-label={`Manage subscription for ${row.plan_tier}`}
                      onClick={
                        canOpenPortal
                          ? handleManageSubscription
                          : () => undefined
                      }
                      disabled={!canOpenPortal}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-muted)] px-4 py-8 text-center text-sm text-muted">
              No billing records match your current filters.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

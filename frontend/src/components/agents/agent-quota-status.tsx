"use client";

import { useMemo } from "react";

import type { AgentRead } from "@/api/generated/model";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const TOKEN_FMT = new Intl.NumberFormat("en-US");

const fmtTokens = (v: number): string =>
  TOKEN_FMT.format(Math.max(Math.trunc(v), 0));

const fmtCost = (v: number): string => `$${v.toFixed(2)}`;

/** Percentage [0..100] clamped. */
const pct = (used: number, limit: number): number =>
  limit <= 0 ? 0 : Math.min(Math.round((used / limit) * 100), 100);

type QuotaLevel = "ok" | "warning" | "critical" | "blocked";

const resolveLevel = (percentage: number, isBlocked: boolean): QuotaLevel => {
  if (isBlocked) return "blocked";
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "warning";
  return "ok";
};

const LEVEL_STYLES: Record<
  QuotaLevel,
  { bar: string; bg: string; text: string; label: string }
> = {
  ok: {
    bar: "bg-emerald-500",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    label: "Healthy",
  },
  warning: {
    bar: "bg-amber-500",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    label: "Running low",
  },
  critical: {
    bar: "bg-red-500",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    label: "Almost exhausted",
  },
  blocked: {
    bar: "bg-red-600",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    label: "Quota reached",
  },
};

const resetHint = (value: string | null | undefined): string => {
  if (!value) return "Resets at next VN midnight.";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Resets at next VN midnight.";
  return `Resets ${d.toLocaleString()}.`;
};

/* ------------------------------------------------------------------ */
/*  Resolved quota data                                               */
/* ------------------------------------------------------------------ */

type ResolvedQuota = {
  kind: "cost" | "token";
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  level: QuotaLevel;
  /** Formatted used string. */
  usedLabel: string;
  /** Formatted limit string. */
  limitLabel: string;
  /** Formatted remaining string. */
  remainingLabel: string;
  resetHint: string;
};

function resolveQuota(agent: AgentRead): ResolvedQuota | null {
  if (agent.is_gateway_main) return null;

  const isBlocked = Boolean(agent.token_blocked);
  const costUsed = agent.cost_used_today;
  const costLimit = agent.cost_limit_today;

  // Cost-primary when cost data actually tracked
  if (
    typeof costUsed === "number" &&
    costUsed > 0 &&
    typeof costLimit === "number" &&
    costLimit > 0
  ) {
    const costRemaining =
      agent.cost_remaining_today ?? Math.max(costLimit - costUsed, 0);
    const p = pct(costUsed, costLimit);
    return {
      kind: "cost",
      used: costUsed,
      limit: costLimit,
      remaining: Math.max(costRemaining, 0),
      percentage: p,
      level: resolveLevel(p, isBlocked),
      usedLabel: fmtCost(costUsed),
      limitLabel: fmtCost(costLimit),
      remainingLabel: fmtCost(Math.max(costRemaining, 0)),
      resetHint: resetHint(agent.token_reset_at),
    };
  }

  // Token fallback
  const used = agent.token_used_today;
  const limit = agent.token_limit_today;
  const remaining = agent.token_remaining_today;
  if (
    typeof used !== "number" ||
    typeof limit !== "number" ||
    typeof remaining !== "number"
  ) {
    return null;
  }
  const p = pct(used, limit);
  const safeRemaining = Math.max(remaining, 0);
  return {
    kind: "token",
    used,
    limit,
    remaining: safeRemaining,
    percentage: p,
    level: resolveLevel(p, isBlocked),
    usedLabel: fmtTokens(used),
    limitLabel: fmtTokens(limit),
    remainingLabel: fmtTokens(safeRemaining),
    resetHint: resetHint(agent.token_reset_at),
  };
}

/* ------------------------------------------------------------------ */
/*  Compact cell (for AgentsTable)                                    */
/* ------------------------------------------------------------------ */

type AgentQuotaCellProps = {
  agent: AgentRead;
};

export function AgentQuotaCell({ agent }: AgentQuotaCellProps) {
  const quota = useMemo(() => resolveQuota(agent), [agent]);

  if (!quota) {
    return <span className="text-sm text-quiet">--</span>;
  }

  const style = LEVEL_STYLES[quota.level];

  return (
    <div
      className="flex min-w-[140px] flex-col gap-1.5"
      title={quota.resetHint}
    >
      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            style.bar,
          )}
          style={{ width: `${quota.percentage}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[color:var(--text)]">
          {quota.remainingLabel}
          <span className="text-quiet"> / {quota.limitLabel}</span>
        </span>
        {quota.level === "blocked" ? (
          <span className="inline-flex shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-700">
            Blocked
          </span>
        ) : quota.level === "critical" ? (
          <span className="inline-flex shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-600">
            {100 - quota.percentage}%
          </span>
        ) : quota.level === "warning" ? (
          <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-600">
            {100 - quota.percentage}%
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card (for agent detail page)                                      */
/* ------------------------------------------------------------------ */

type AgentQuotaCardProps = {
  agent: AgentRead;
  className?: string;
};

export function AgentQuotaCard({ agent, className }: AgentQuotaCardProps) {
  const quota = useMemo(() => resolveQuota(agent), [agent]);

  if (!quota) {
    return null;
  }

  const style = LEVEL_STYLES[quota.level];
  const unitLabel = quota.kind === "cost" ? "Cost" : "Tokens";

  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-quiet">
          Daily quota
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            style.bg,
            style.text,
          )}
        >
          <span
            className={cn("inline-block h-1.5 w-1.5 rounded-full", style.bar)}
          />
          {style.label}
        </span>
      </div>

      {/* Main progress */}
      <div className="mt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-semibold text-strong tabular-nums">
              {quota.remainingLabel}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              remaining of {quota.limitLabel} daily {unitLabel.toLowerCase()}{" "}
              budget
            </p>
          </div>
          <p className="text-sm font-semibold tabular-nums text-muted">
            {quota.percentage}% used
          </p>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              style.bar,
            )}
            style={{ width: `${quota.percentage}%` }}
          />
        </div>
      </div>

      {/* Detail grid */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-quiet">
            Used
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--text)] tabular-nums">
            {quota.usedLabel}
          </p>
        </div>
        <div className="rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-quiet">
            Remaining
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--text)] tabular-nums">
            {quota.remainingLabel}
          </p>
        </div>
        <div className="rounded-lg bg-[color:var(--surface-muted)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-quiet">
            Limit
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--text)] tabular-nums">
            {quota.limitLabel}
          </p>
        </div>
      </div>

      {/* Reset hint */}
      <p className="mt-3 text-xs text-quiet">{quota.resetHint}</p>

      {/* Blocked alert */}
      {quota.level === "blocked" ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-red-700">
              Agent is blocked
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-red-600">
              Daily {unitLabel.toLowerCase()} quota has been reached. The agent
              will resume after the next reset cycle.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

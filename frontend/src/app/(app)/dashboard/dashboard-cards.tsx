"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";

import type { SummaryRow } from "./dashboard-utils";

export function TopMetricCard({
  title,
  value,
  secondary,
  infoText,
  icon,
  accent,
}: {
  title: string;
  value: string;
  secondary?: string;
  infoText?: string;
  icon: ReactNode;
  accent: "blue" | "green" | "violet" | "emerald";
}) {
  const iconTone =
    accent === "blue"
      ? "icon-bg-info"
      : accent === "green"
        ? "icon-bg-success"
        : accent === "violet"
          ? "icon-bg-info"
          : "icon-bg-success";

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {title}
            </p>
            {infoText ? (
              <span
                className="inline-flex text-quiet"
                title={infoText}
                aria-label={infoText}
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <p className="font-heading text-4xl font-bold text-strong">{value}</p>
            {secondary ? (
              <p className="pb-1 text-xs text-muted">{secondary}</p>
            ) : null}
          </div>
        </div>
        <div className={`rounded-lg p-2 ${iconTone}`}>
          {icon}
        </div>
      </div>
    </section>
  );
}

export function InfoBlock({
  title,
  badge,
  infoText,
  rows,
}: {
  title: string;
  badge?: { text: string; tone: "online" | "offline" | "neutral" };
  infoText?: string;
  rows: SummaryRow[];
}) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold text-strong">{title}</h3>
          {infoText ? (
            <span
              className="inline-flex text-quiet"
              title={infoText}
              aria-label={infoText}
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
        {badge ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              badge.tone === "online"
                ? "status-badge-success"
                : badge.tone === "offline"
                  ? "status-badge-danger"
                  : "status-badge-neutral"
            }`}
          >
            {badge.text}
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-3 px-3 py-2">
            <span className="min-w-0 text-sm text-muted">{row.label}</span>
            <span
              className={`max-w-[65%] break-words text-right text-sm font-medium leading-5 ${
                row.tone === "success"
                  ? "text-status-success"
                  : row.tone === "warning"
                    ? "text-status-warning"
                    : row.tone === "danger"
                      ? "text-status-danger"
                      : "text-strong"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

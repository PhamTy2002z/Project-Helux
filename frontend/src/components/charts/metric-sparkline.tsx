"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";
import { getChartColors } from "./chart-theme";

type MetricSparklineProps = {
  values: number[];
  bucket?: string;
  labels?: string[];
  className?: string;
};

const buildSparkData = (values: number[]) =>
  values.map((value, index) => ({
    index,
    value,
  }));

const formatSparkValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
};

type SparklineTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: unknown;
    payload?: { index?: unknown };
  }>;
  bucket?: string;
  labels?: string[];
};

const SparklineTooltip = ({
  active,
  payload,
  bucket,
  labels,
}: SparklineTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  const rawValue = entry?.value;
  if (typeof rawValue !== "number") {
    return null;
  }
  const dayIndex =
    typeof entry.payload?.index === "number" ? entry.payload.index + 1 : null;
  const labelIndex =
    typeof entry.payload?.index === "number" ? entry.payload.index : null;
  const resolvedLabel = labelIndex !== null ? labels?.[labelIndex] : undefined;
  const label =
    bucket === "week"
      ? "Week"
      : bucket === "month"
        ? "Month"
        : bucket === "year"
          ? "Year"
          : "Day";
  const prefix = resolvedLabel ?? (dayIndex ? `${label} ${dayIndex}` : "");
  return (
    <div
      className="rounded-md px-2 py-1 text-xs font-medium shadow-sm"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
      }}
    >
      {prefix ? `${prefix}: ` : ""}
      {formatSparkValue(rawValue)}
    </div>
  );
};

export default function MetricSparkline({
  values,
  bucket,
  labels,
  className,
}: MetricSparklineProps) {
  const gradientId = useId();
  const { theme } = useTheme();
  // Re-derive palette when the theme changes
  const colors = useMemo(() => getChartColors(), [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!values.length) {
    return null;
  }

  const data = buildSparkData(values);
  // Use accent-strong for stroke (bright in both modes); accent for fill gradient base
  const strokeColor = colors.accentStrong;
  const fillColor = colors.accent;

  return (
    <div className={cn("h-8 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={false}
            content={(props) => (
              <SparklineTooltip
                {...(props as SparklineTooltipProps)}
                bucket={bucket}
                labels={labels}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

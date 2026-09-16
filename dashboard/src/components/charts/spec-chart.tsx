"use client";

/**
 * Recharts renderer for a ChartSpec built at render time from the bundle
 * (ticket #17). Client-side because recharts needs the DOM; every figure it
 * draws arrives as props from a server component that read the synced bundle.
 * Null points keep their gaps (preliminary/mixed windows are never joined).
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartSpec } from "@/lib/chart-data";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatAxisValue(unit: string, v: number): string {
  if (unit === "persons") {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  if (unit === "rm_million") {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  return String(v);
}

function formatTooltipValue(unit: string, v: number | null): string {
  if (v === null) return "no data";
  const suffix = unit === "persons" ? "" : unit === "rm_million" ? " RM million" : "";
  return `${new Intl.NumberFormat("en-US").format(v)}${suffix}`;
}

export function SpecChart({ spec }: { spec: ChartSpec }) {
  // One chart per trace: bases are never merged, so a mixed-basis spec would
  // otherwise compare tourist-basis against visitor-basis years on one axis.
  return (
    <div className="flex flex-col gap-4">
      {spec.series.map((trace, i) => {
        const data = trace.points.map(([year, value]) => ({ year: String(year), value }));
        return (
          <div key={trace.name} className="flex flex-col gap-1">
            <p className="text-sm font-medium">{trace.name}</p>
            <p className="text-xs text-muted-foreground">{trace.basisLabel}</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickMargin={4} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => formatAxisValue(trace.unit, v)}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value) => formatTooltipValue(trace.unit, value as number | null)}
                    labelFormatter={(label) => `${label}${/p$/.test(String(label)) ? " (preliminary)" : ""}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

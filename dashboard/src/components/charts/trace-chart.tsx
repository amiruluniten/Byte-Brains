"use client";

/**
 * Ticket #18: recharts renderer for the decomposition traces (name, unit,
 * points) with per-trace notice lines. Like SpecChart, every figure arrives
 * as props from a server component that read the synced bundle; null points
 * keep their gaps. A trace flagged INVALID (nominal, not price-adjusted)
 * renders its notice in the destructive tone so the flag cannot be missed.
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { fmtNum } from "@/lib/format";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export interface TraceSpec {
  name: string;
  unit: string;
  points: [number, number | null][];
  /** Rendered under the trace title (e.g. the nominal-vs-real label). */
  notice?: string | null;
  /** When true the notice renders with the INVALID (destructive) treatment. */
  invalid?: boolean;
}

/** The one index-unit predicate (ticket #21): an "index …" unit renders as a
 * bare rounded number on the axis and an unsuffixed tooltip value. */
function isIndexUnit(unit: string): boolean {
  return /^index/.test(unit);
}

function formatTooltipValue(unit: string, v: number | null): string {
  if (v === null) return "no data";
  const num = fmtNum(v);
  if (isIndexUnit(unit)) return num;
  return `${num} ${unit}`;
}

export function TraceChart({ traces }: { traces: TraceSpec[] }) {
  return (
    <div className="flex flex-col gap-4">
      {traces.map((trace, i) => {
        const data = trace.points.map(([year, value]) => ({ year: String(year), value }));
        const indexed = isIndexUnit(trace.unit);
        return (
          <div key={trace.name} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-sm">{trace.name}</p>
              {trace.notice && trace.invalid && (
                <Badge variant="destructive" aria-label="nominal figure flagged INVALID">
                  INVALID &mdash; nominal
                </Badge>
              )}
            </div>
            {trace.notice && (
              <p className={trace.invalid ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {trace.notice}
              </p>
            )}
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickMargin={4} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={56}
                    tickFormatter={(v: number) =>
                      indexed
                        ? String(Math.round(v))
                        : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)
                    }
                  />
                  {/* x-keys are plain years, so no preliminary-suffix handling here. */}
                  <Tooltip formatter={(value) => formatTooltipValue(trace.unit, value as number | null)} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={trace.invalid ? "var(--destructive)" : CHART_COLORS[i % CHART_COLORS.length]}
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

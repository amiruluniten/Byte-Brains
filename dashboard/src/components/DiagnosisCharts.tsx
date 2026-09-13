"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { DecompositionTrace, RegionalRow, MarketMapData } from "../lib/diagnosis";

const AXIS = { color: "#e6e6e6" };
const MUTED = { color: "#9aa0a6" };

/** Multi-series line chart (indexes, per-visitor paths). */
export function LineChart({
  title,
  subtitle,
  traces,
  yLabel,
  height = 420,
}: {
  title: string;
  subtitle: string;
  traces: DecompositionTrace[];
  yLabel: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({
      title: { text: title, subtext: subtitle, left: "center", textStyle: { ...AXIS }, subtextStyle: { ...MUTED } },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { ...MUTED } },
      grid: { top: 90, left: 70, right: 30, bottom: 70 },
      xAxis: {
        type: "value",
        name: "Year",
        nameTextStyle: { ...MUTED },
        axisLabel: { ...AXIS, formatter: (v: number) => String(Math.round(v)) },
        min: (e: { min: number; max: number }) => e.min - 0.5,
        max: (e: { min: number; max: number }) => e.max + 0.5,
      },
      yAxis: { type: "value", name: yLabel, nameTextStyle: { ...MUTED }, axisLabel: { ...AXIS, formatter: (v: number) => v.toLocaleString("en-MY") } },
      series: traces.map((t) => ({
        name: t.name,
        type: "line",
        connectNulls: false,
        data: t.points.map(([y, v]) => [y, v]),
      })),
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [title, subtitle, traces, yLabel]);
  return <div ref={ref} style={{ width: "100%", height }} role="img" aria-label={title} />;
}

/** Grouped bar chart for the regional comparison (2024 vs 2019 yields). */
export function RegionalBarChart({
  rows,
  anchorYear,
  baselineYear,
  height = 420,
}: {
  rows: RegionalRow[];
  anchorYear: number;
  baselineYear: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({
      title: {
        text: `Receipts per visitor, ${anchorYear} vs ${baselineYear} (USD)`,
        subtext: "2024: officially published figures. 2019: World Bank WDI (latest comparable year).",
        left: "center",
        textStyle: { ...AXIS },
        subtextStyle: { ...MUTED },
      },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { ...MUTED } },
      grid: { top: 80, left: 70, right: 30, bottom: 60 },
      xAxis: { type: "category", data: rows.map((r) => r.country), axisLabel: { ...AXIS } },
      yAxis: { type: "value", name: "USD per visitor", nameTextStyle: { ...MUTED }, axisLabel: { ...AXIS, formatter: (v: number) => v.toLocaleString("en-MY") } },
      series: [
        {
          name: `${anchorYear} yield (official)`,
          type: "bar",
          data: rows.map((r) => ({
            value: r.yield2024Usd,
            itemStyle: { color: r.isBaseline ? "#4f8cff" : "#e6b84f" },
          })),
          label: { show: true, position: "top", color: "#e6e6e6", formatter: ({ value }: { value: number }) => `$${value.toLocaleString("en-MY")}` },
        },
        {
          name: `${baselineYear} yield (WDI baseline)`,
          type: "bar",
          data: rows.map((r) => r.yield2019Usd),
          label: { show: true, position: "top", color: "#9aa0a6", formatter: ({ value }: { value: number }) => `$${value.toLocaleString("en-MY")}` },
        },
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [rows, anchorYear, baselineYear]);
  return <div ref={ref} style={{ width: "100%", height }} role="img" aria-label={`Regional yields ${anchorYear} vs ${baselineYear}`} />;
}

// Segment palette (closed vocabulary order-stable colours)
const SEGMENT_COLORS: Record<string, string> = {
  "Volume Traps": "#e0564f",
  "High-Yield Long-Haul": "#4f8cff",
  "High-Growth Emerging": "#3fae6a",
  "Mid-Yield Steady": "#9a86d6",
  "Low-Yield Steady": "#8a8f9c",
};

/**
 * Source-market yield map. Shades countries by receipts-per-visitor (2024),
 * with a toggle to overlay the named segmentation instead. Geometry ships
 * from the committed Natural Earth-derived world.json (public domain) —
 * no runtime map tiles, no network.
 */
export function YieldMap({ mapData, height = 560 }: { mapData: MarketMapData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"yield" | "segment">("yield");
  const [geo, setGeo] = useState<{ type: string; features: unknown[] } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/geo/world.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((g) => alive && setGeo(g))
      .catch((e) => alive && setGeoError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !geo) return;
    echarts.registerMap("world", geo as never);
    const chart = echarts.init(el);

    const withYield = mapData.markets.filter((m) => m.yieldRmPerVisitor !== null);
    const yields = withYield.map((m) => m.yieldRmPerVisitor as number);
    const min = Math.min(...yields);
    const max = Math.max(...yields);

    interface Tip {
      market: string;
      yieldRm: number | null;
      arrivals: number | null;
      segment: string | null;
      tierLabel: string | null;
      reason: string | null;
    }
    const tipByName = new Map<string, Tip>();
    for (const m of mapData.markets) {
      tipByName.set(m.geoName, {
        market: m.market,
        yieldRm: m.yieldRmPerVisitor,
        arrivals: m.arrivals2024,
        segment: m.segmentName,
        tierLabel: m.tierLabel,
        reason: m.excludedReason,
      });
    }

    const tooltipFormatter = (params: { name: string }): string => {
      const t = tipByName.get(params.name);
      if (!t) return `<b>${params.name}</b><br/>not a tracked source market`;
      const lines = [`<b>${t.market}</b>`];
      if (t.yieldRm !== null) lines.push(`Yield 2024: RM ${t.yieldRm.toLocaleString("en-MY")} per visitor`);
      else lines.push("No 2024 yield (partial table coverage)");
      if (t.arrivals !== null) lines.push(`Arrivals 2024: ${t.arrivals.toLocaleString("en-MY")}`);
      if (t.segment) lines.push(`Segment: ${t.segment}${t.tierLabel ? ` — ${t.tierLabel}` : ""}`);
      if (t.reason) lines.push(`<i>${t.reason}</i>`);
      return lines.join("<br/>");
    };

    if (mode === "yield") {
      chart.setOption({
        tooltip: { trigger: "item", formatter: tooltipFormatter },
        visualMap: {
          min,
          max,
          text: ["RM/visitor: high", "low"],
          calculable: true,
          left: "left",
          top: "middle",
          textStyle: { ...MUTED },
          inRange: { color: ["#2c3a55", "#4f8cff", "#e6b84f", "#e0564f"] },
        },
        series: [
          {
            type: "map",
            map: "world",
            roam: true,
            data: withYield.map((m) => ({ name: m.geoName, value: m.yieldRmPerVisitor })),
          },
        ],
      });
    } else {
      const segments = [...new Set(mapData.markets.filter((m) => m.segmentName).map((m) => m.segmentName as string))];
      chart.setOption({
        tooltip: { trigger: "item", formatter: tooltipFormatter },
        visualMap: { show: false },
        series: [
          {
            type: "map",
            map: "world",
            roam: true,
            data: mapData.markets.map((m) => ({
              name: m.geoName,
              value: 1,
              itemStyle: m.segmentName ? { areaColor: SEGMENT_COLORS[m.segmentName] ?? "#888" } : { areaColor: "#3a3f4c" },
            })),
          },
        ],
        graphic: segments.length
          ? []
          : [
              {
                type: "text",
                left: "center",
                top: 12,
                style: { fill: "#9aa0a6", text: "Segmentation not present in this data bundle — shade by yield instead" },
              },
            ],
      });
    }
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [geo, mapData, mode]);

  const segments = [...new Set(mapData.markets.filter((m) => m.segmentName).map((m) => m.segmentName as string))];

  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...MUTED, fontSize: 13 }}>Shade markets by:</span>
        <button onClick={() => setMode("yield")} style={mode === "yield" ? activeBtn : btn}>
          Yield per visitor (RM)
        </button>
        <button onClick={() => setMode("segment")} style={mode === "segment" ? activeBtn : btn}>
          Named segment (overlay)
        </button>
        {mode === "segment" && (
          <span style={{ fontSize: 13, display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
            {segments.map((s) => (
              <span key={s}>
                <span style={{ color: SEGMENT_COLORS[s] ?? "#888" }}>■</span> {s}
              </span>
            ))}
          </span>
        )}
      </div>
      {geoError && (
        <p style={{ color: "#e0564f" }}>
          Map geometry failed to load ({geoError}). The page degrades to the table below — no numbers are lost.
        </p>
      )}
      <div ref={ref} style={{ width: "100%", height: geo ? height : 80 }} role="img" aria-label="Source-market yield map" />
      {!geo && !geoError && <p style={{ ...MUTED }}>Loading map geometry…</p>}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#1c1f27",
  border: "1px solid #3a3f4c",
  color: "#e6e6e6",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 13,
};
const activeBtn: React.CSSProperties = { ...btn, borderColor: "#4f8cff", color: "#4f8cff" };

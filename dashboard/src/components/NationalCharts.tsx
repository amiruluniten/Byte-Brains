"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { ChartSpec } from "../lib/chart-data";

/**
 * Client-side ECharts renderer for a ChartSpec derived from the bundle.
 * The spec arrives fully computed from the build-time page; this component
 * only draws. If drawing fails (e.g. a bad spec), the error boundary above
 * the page shows a clear message — never a blank region.
 */
export default function NationalChart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({
      title: { text: spec.title, subtext: spec.subtitle, left: "center", textStyle: { color: "#e6e6e6" }, subtextStyle: { color: "#9aa0a6" } },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: "#e6e6e6" } },
      grid: { top: 90, left: 70, right: 30, bottom: 60 },
      xAxis: {
        type: "category",
        name: "Year",
        nameTextStyle: { color: "#9aa0a6" },
        axisLabel: { color: "#e6e6e6" },
      },
      yAxis: {
        type: "value",
        name: spec.series[0]?.unit === "rm_million" ? "RM million" : "Persons",
        nameTextStyle: { color: "#9aa0a6" },
        axisLabel: { color: "#e6e6e6", formatter: (v: number) => v.toLocaleString("en-MY") },
      },
      series: spec.series.map((trace) => ({
        name: trace.name,
        type: "bar",
        data: trace.points.map(([year, value]) => [String(year), value]),
      })),
    });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [spec]);

  return (
    <div>
      <div ref={ref} style={{ width: "100%", height: 460 }} role="img" aria-label={spec.title} />
      <ul style={{ fontSize: 12, color: "#9aa0a6", lineHeight: 1.6, marginTop: 8 }}>
        {spec.series.map((trace) => (
          <li key={trace.name}>{trace.basisLabel}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Derive recharts-ready chart specs from the validated bundle.
 *
 * Counting-basis discipline (CONTEXT.md, bundle contract): traces are never
 * merged across bases. Every trace carries a human-readable basis label that
 * states the basis and its window, so a tourist-basis series (2015-2023) and a
 * visitor-basis series (2019-2024) sit side by side, clearly labelled.
 * Preliminary years never masquerade as final data: a series whose latest
 * observation is preliminary carries "2025p" in its name and label.
 */
import { type Bundle, type Basis, type Series } from "./bundle";

export interface ChartTrace {
  name: string; // legend label, includes basis wording
  basis: Basis;
  basisLabel: string; // explicit "tourist basis (2015-2023), DOSM TSA" style label
  unit: string;
  window: string;
  points: [number, number | null][]; // [year, value]; null keeps the gap visible
}

export interface ChartSpec {
  title: string;
  subtitle: string;
  series: ChartTrace[];
}

export function basisLabelFor(s: Series): string {
  // CONTEXT.md vocabulary: prefer "same-day visitor" in prose; "excursionist"
  // stays as the technical basis token from the bundle.
  const basisWord =
    s.basis === "excursionist" ? "same-day visitor (excursionist)" : s.basis;
  return `${basisWord} basis (${s.window}), source: DOSM TSA ${s.source.file}`;
}

function measureWord(s: Series): string {
  if (s.measure === "arrivals") return "arrivals";
  if (s.measure === "inbound_tourism_consumption") return "inbound consumption";
  return s.measure.replace(/_/g, " ");
}

/** "2025p" suffix for a series whose latest year is preliminary. */
function windowLabel(s: Series): string {
  const last = s.values[s.values.length - 1];
  return last && last.revision_status === "preliminary" ? `${s.window}, ${last.year}p` : s.window;
}

function toTrace(s: Series): ChartTrace {
  return {
    name: `${basisWord(s.basis)} ${measureWord(s)} (${windowLabel(s)})`,
    basis: s.basis,
    basisLabel: basisLabelFor(s),
    unit: s.unit,
    window: s.window,
    points: s.values.map((o) => [o.year, o.value] as [number, number | null]),
  };
}

function basisWord(b: Basis): string {
  switch (b) {
    case "visitor":
      return "Visitor";
    case "tourist":
      return "Tourist";
    case "excursionist":
      return "Same-day visitor";
  }
}

export function buildArrivalsChart(bundle: Bundle): ChartSpec {
  const series = bundle.fragments.national_series.series
    .filter((s) => s.measure === "arrivals")
    .sort((a, b) => a.series_id.localeCompare(b.series_id));
  return {
    title: "Extensive side: visitor arrivals",
    subtitle:
      "Growth from more visitors. Bases are not comparable — each trace is labelled with its counting basis and window.",
    series: series.map(toTrace),
  };
}

export function buildReceiptsChart(bundle: Bundle): ChartSpec {
  const series = bundle.fragments.national_series.series
    .filter((s) => s.measure === "inbound_tourism_consumption")
    .sort((a, b) => a.window.localeCompare(b.window));
  if (series.length === 0) {
    throw new Error("bundle has no inbound tourism consumption series");
  }
  return {
    title: "Intensive side: tourism receipts (inbound consumption)",
    subtitle:
      "Growth from more value per visitor. Inbound tourism consumption, RM million, tourist basis.",
    series: series.map(toTrace),
  };
}

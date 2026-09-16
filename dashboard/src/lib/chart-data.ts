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
import { BASIS_LABELS, type Bundle, type Series, yearLabel } from "./bundle";

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
  return `${BASIS_LABELS[s.basis].long} basis (${s.window}), source: DOSM TSA ${s.source.file}`;
}

function measureWord(s: Series): string {
  if (s.measure === "arrivals") return "arrivals";
  if (s.measure === "inbound_tourism_consumption") return "inbound consumption";
  return s.measure.replace(/_/g, " ");
}

/** Appends the "2025p" preliminary label when a series' latest year is preliminary. */
function windowLabel(s: Series): string {
  const last = s.values[s.values.length - 1];
  return last && last.revision_status === "preliminary" ? `${s.window}, ${yearLabel(last)}` : s.window;
}

function toTrace(s: Series): ChartTrace {
  return {
    name: `${BASIS_LABELS[s.basis].word} ${measureWord(s)} (${windowLabel(s)})`,
    basis: s.basis,
    basisLabel: basisLabelFor(s),
    unit: s.unit,
    window: s.window,
    points: s.values.map((o) => [o.year, o.value] as [number, number | null]),
  };
}

/**
 * The one filter→sort→throw-if-empty→map scaffold (ticket #21) behind every
 * chart builder. Sorting is deterministic (localeCompare on the sort key), and
 * an empty selection fails loudly instead of rendering an empty chart.
 */
function buildChart(
  bundle: Bundle,
  opts: {
    filter: (s: Series) => boolean;
    sortKey: (s: Series) => string;
    emptyError: string;
    title: string;
    subtitle: string;
  }
): ChartSpec {
  const series = bundle.fragments.national_series.series
    .filter(opts.filter)
    .sort((a, b) => opts.sortKey(a).localeCompare(opts.sortKey(b)));
  if (series.length === 0) {
    throw new Error(opts.emptyError);
  }
  return { title: opts.title, subtitle: opts.subtitle, series: series.map(toTrace) };
}

export function buildArrivalsChart(bundle: Bundle): ChartSpec {
  return buildChart(bundle, {
    filter: (s) => s.measure === "arrivals",
    sortKey: (s) => s.series_id,
    emptyError: "bundle has no arrivals series",
    title: "Extensive side: visitor arrivals",
    subtitle:
      "Growth from more visitors. Bases are not comparable — each trace is labelled with its counting basis and window.",
  });
}

export function buildReceiptsChart(bundle: Bundle): ChartSpec {
  return buildChart(bundle, {
    filter: (s) => s.measure === "inbound_tourism_consumption",
    sortKey: (s) => s.window,
    emptyError: "bundle has no inbound tourism consumption series",
    title: "Intensive side: tourism receipts (inbound consumption)",
    subtitle:
      "Growth from more value per visitor. Inbound tourism consumption, RM million, tourist basis.",
  });
}

/**
 * Ticket #17: the tourist vs same-day visitor split — the Volume Trap made
 * visible. Same-day visitors (excursionists) count in arrivals but generate
 * low yield, so the arrivals KPI over-rewards them. Bases stay labelled and
 * never merged, exactly like every other chart built from the bundle.
 */
export function buildVisitorSplitChart(bundle: Bundle): ChartSpec {
  return buildChart(bundle, {
    filter: (s) => s.measure === "arrivals" && s.basis !== "visitor",
    sortKey: (s) => s.series_id,
    emptyError: "bundle has no tourist / same-day visitor arrivals series",
    title: "Who visits: tourists vs same-day visitors",
    subtitle:
      "Same-day visitors count in arrivals but generate low yield — the Volume Trap. Bases are labelled, never merged.",
  });
}

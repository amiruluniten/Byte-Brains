/**
 * Ticket T6: diagnosis data builders — decomposition, regional comparison,
 * source-market map, and the method index. Every function takes ONLY the
 * validated bundle (the single seam); no hardcoded figures live here or in
 * the pages. Where a fragment is optional, callers degrade gracefully.
 *
 * Framing contract (CONTEXT.md): the Missing Billions (constant-2019-prices,
 * RM10.2B cumulative 2020-2024) and the stagnation line are the headline;
 * the regional gap is supporting context, never the headline.
 */
import type {
  Bundle,
  CounterfactualYear,
  MarketSegment,
  MissingBillionsFragment,
  Observation,
  RegionalBenchmarkFragment,
  RegionalCountry,
  RevisionStatus,
  SegmentationFragment,
  SourceMarketFragment,
  YieldTier,
} from "./bundle";

// ---------------------------------------------------------------------------
// Decomposition: extensive (volume) vs intensive (value) growth
// ---------------------------------------------------------------------------

export interface DecompositionTrace {
  name: string;
  points: [number, number | null][]; // [year, value]
  kind: "index" | "per_visitor";
  unit: string;
}

/** A "2025p"-style year label: preliminary years are always marked. */
export function yearLabel(o: Pick<Observation, "year"> & { revision_status?: RevisionStatus }): string {
  return o.revision_status === "preliminary" ? `${o.year}p` : String(o.year);
}

/** The guarded headline + the labelled supplementary cumulative. */
export interface HeadlineSpec {
  window: { from: number; to: number };
  prices: "constant_2019_rm";
  /** The pre-registered cumulative gap — equals the fragment's own row sum
   * (checked by the bundle parser); NEVER replaced by a longer window. */
  cumulativeGapRmMillion: number;
  basisNote: string;
}

export interface SupplementarySpec {
  window: { from: number; to: number };
  label: string;
  cumulativeGapRmMillion: number;
}

export interface DecompositionSpec {
  anchorYear: number;
  /** Volume vs value, indexed to the anchor year = 100. */
  indexed: DecompositionTrace[];
  /** Per-visitor receipts: nominal vs real (anchor-year prices) — the
   * real-vs-nominal distinction the Missing Billions headline rests on. */
  perVisitor: DecompositionTrace[];
  /** The pre-registered headline (window-guarded in the bundle parser). */
  headline: HeadlineSpec;
  /** Cumulative BEYOND the headline window (e.g. including preliminary 2025) —
   * labelled supplementary, never quoted as the headline. */
  supplementary: SupplementarySpec | null;
  basisNotes: string[];
  stagnation: {
    anchorPerVisitorRealRm: number;
    /** The headline window's final year — the stagnation line's year. */
    latestYear: number;
    latestPerVisitorRealRm: number;
  };
}

/** Sum the real-terms gap (positive = missing billions) over the given years. */
export function cumulativeMissingBillions(
  frag: MissingBillionsFragment,
  fromYear: number,
  toYear: number
): number {
  return frag.years
    .filter((y) => y.year >= fromYear && y.year <= toYear)
    .reduce((sum, y) => sum + y.gap_2019_prices_rm_million, 0);
}

/**
 * Build the decomposition from the missing_billions fragment (which pairs the
 * TSA inbound consumption with visitor-basis arrivals and the CPI deflator —
 * the same real-terms arithmetic as the headline). Requires the fragment;
 * callers render a graceful notice when it is absent.
 */
export function buildDecomposition(frag: MissingBillionsFragment): DecompositionSpec {
  const years = [...frag.years].sort((a, b) => a.year - b.year);
  const anchor = years.find((y) => y.year === frag.anchor_year);
  if (!anchor) {
    throw new Error(`missing_billions fragment has no anchor-year (${frag.anchor_year}) observation`);
  }
  const indexAt = (v: number, base: number): number => (v / base) * 100;
  const indexed: DecompositionTrace[] = [
    {
      name: "Visitor arrivals (volume — extensive side)",
      kind: "index",
      unit: "index (2019 = 100)",
      points: years.map((y) => [y.year, indexAt(y.visitor_arrivals, anchor.visitor_arrivals)]),
    },
    {
      name: "Receipts, nominal RM (value — intensive side)",
      kind: "index",
      unit: "index (2019 = 100)",
      points: years.map((y) => [
        y.year,
        indexAt(y.receipts_nominal_rm_million, anchor.receipts_nominal_rm_million),
      ]),
    },
    {
      name: "Receipts, real 2019 RM (value at 2019 prices)",
      kind: "index",
      unit: "index (2019 = 100)",
      points: years.map((y) => [
        y.year,
        indexAt(y.actual_receipts_2019_prices_rm_million, anchor.actual_receipts_2019_prices_rm_million),
      ]),
    },
    {
      name: "Counterfactual: receipts at the 2019 real per-visitor yield (real 2019 RM)",
      kind: "index",
      unit: "index (2019 = 100)",
      points: years.map((y) => [
        y.year,
        indexAt(
          y.counterfactual_receipts_2019_prices_rm_million,
          anchor.counterfactual_receipts_2019_prices_rm_million
        ),
      ]),
    },
  ];
  const perVisitor: DecompositionTrace[] = [
    {
      name: "Per-visitor receipts, nominal RM",
      kind: "per_visitor",
      unit: "RM per visitor",
      points: years.map((y) => [y.year, y.per_visitor_nominal_rm]),
    },
    {
      name: "Per-visitor receipts, real 2019 RM (what a visitor is worth in 2019 money)",
      kind: "per_visitor",
      unit: "RM per visitor",
      points: years.map((y) => [y.year, y.per_visitor_real_2019_rm]),
    },
  ];
  // ticket #13: the headline comes from the guarded, pre-registered block —
  // never from "whatever the latest year is" (the 2025p row may not move it).
  const [hFrom, hTo] = frag.headline.window.split("-").map((x) => Number(x));
  const headlineYearRow = years.find((y) => y.year === hTo);
  if (!headlineYearRow) {
    throw new Error(`missing_billions has no row for the headline window end (${hTo})`);
  }
  let supplementary: SupplementarySpec | null = null;
  if (frag.supplementary) {
    const [sFrom, sTo] = frag.supplementary.window.split("-").map((x) => Number(x));
    supplementary = {
      window: { from: sFrom, to: sTo },
      label: frag.supplementary.label,
      cumulativeGapRmMillion: frag.supplementary.cumulative_gap_rm_million,
    };
  }
  const lastYear = years[years.length - 1];
  return {
    anchorYear: frag.anchor_year,
    indexed,
    perVisitor,
    headline: {
      window: { from: hFrom, to: hTo },
      prices: "constant_2019_rm",
      cumulativeGapRmMillion: frag.headline.cumulative_gap_rm_million,
      basisNote: frag.headline.basis_note,
    },
    supplementary,
    basisNotes: [
      `Volume: visitor-basis arrivals (${frag.arrivals_series_id}).`,
      `Value: inbound tourism consumption, tourist basis (${frag.receipts_series_id}) — the ticket's pairing; the two bases are labelled, never merged.`,
      `Real terms: deflated by the national CPI (${frag.deflator.series_id}, ${frag.deflator.index_base}, fetched ${frag.deflator.source.fetched_utc.slice(0, 10)}) to constant ${frag.anchor_year} prices.`,
      "The naive nominal gap (comparing ringgit of different years) is INVALID — the bundle emits it flagged, and per the data it shows a false surplus.",
      `The headline is the pre-registered window ${frag.headline.window} at constant ${frag.anchor_year} prices (RM${frag.headline.cumulative_gap_rm_million.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} million).`,
      frag.supplementary
        ? `Supplementary only (never the headline): ${frag.supplementary.label}`
        : undefined,
      `${lastYear.revision_status === "preliminary" ? `${lastYear.year}p` : lastYear.year}: the latest fragment year; ${lastYear.revision_status === "preliminary" ? "preliminary, labelled 2025p everywhere" : `revision status ${lastYear.revision_status}`}.`,
    ].filter((s): s is string => s !== undefined),
    stagnation: {
      anchorPerVisitorRealRm: anchor.per_visitor_real_2019_rm,
      latestYear: hTo,
      latestPerVisitorRealRm: headlineYearRow.per_visitor_real_2019_rm,
    },
  };
}

// ---------------------------------------------------------------------------
// Regional comparison (supporting context — never the headline)
// ---------------------------------------------------------------------------

export const RECEIPTS_BASIS_LABEL: Record<RegionalCountry["receipts_basis"], string> = {
  survey: "survey (visitor expenditure survey)",
  balance_of_payments: "balance of payments (administrative)",
  administrative_aggregate: "administrative aggregate",
};

export interface RegionalRow {
  country: string;
  isBaseline: boolean;
  yield2024Usd: number;
  yield2019Usd: number;
  changePct: number;
  multipleOfMalaysia: number | null;
  arrivals2024: number;
  usdBillion2024: number;
  receiptsBasisLabel: string;
  receiptsBasisNote: string;
  sourceUrls: string[];
}

export interface RegionalComparison {
  anchorYear: number;
  baselineYear: number;
  baselineMarket: string;
  rows: RegionalRow[];
  excluded: { country: string; reason: string }[];
  caveats: string[];
  researchDoc: string;
}

export function buildRegionalComparison(frag: RegionalBenchmarkFragment): RegionalComparison {
  const rows: RegionalRow[] = frag.countries.map((c) => ({
    country: c.country,
    isBaseline: c.role === "baseline",
    yield2024Usd: c.yield_2024_usd_per_visitor,
    yield2019Usd: c.yield_2019_usd_per_visitor,
    changePct: c.yield_change_2024_vs_2019_pct,
    multipleOfMalaysia: c.yield_multiple_of_malaysia_2024 ?? null,
    arrivals2024: c.arrivals_2024,
    usdBillion2024: c.receipts_2024.usd_billion,
    receiptsBasisLabel: RECEIPTS_BASIS_LABEL[c.receipts_basis],
    receiptsBasisNote: c.receipts_basis_note,
    sourceUrls: c.source_urls,
  }));
  return {
    anchorYear: frag.anchor_year,
    baselineYear: frag.baseline_year,
    baselineMarket: frag.baseline_market,
    rows,
    excluded: frag.excluded_markets.map((e) => ({ country: e.country, reason: e.reason })),
    caveats: frag.caveats,
    researchDoc: frag.research_doc,
  };
}

// ---------------------------------------------------------------------------
// Source-market yield map with segment overlay
// ---------------------------------------------------------------------------

/** Bundle market name -> feature name in public/geo/world.json (Natural Earth). */
export const GEO_NAME_OVERRIDES: Record<string, string> = {
  "United States": "United States of America",
  "Chinese Taipei": "Taiwan",
};

export interface MapMarket {
  market: string;
  geoName: string;
  yieldRmPerVisitor: number | null; // null where the market has no yield
  /** The year the yield/arrivals pair was read at (2024 in the current bundle). */
  yieldYear: number | null;
  arrivals2024: number | null;
  coverage: SourceMarketFragment["markets"][number]["coverage"];
  clustered: boolean;
  segmentName: string | null;
  tier: YieldTier | null;
  tierLabel: string | null;
  excludedReason: string | null;
}

export interface MarketMapData {
  markets: MapMarket[];
  /** Markets that cannot be shaded on the map geometry (no geo entity). */
  missingFromGeometry: string[];
  segmentationAvailable: boolean;
}

/**
 * Join the source_market fragment (yields) with the segmentation fragment
 * (named segments, tiers). When segmentation is absent from the bundle the
 * map still shades by yield — the overlay simply disappears.
 */
export function buildMarketMapData(
  sourceMarket: SourceMarketFragment,
  segmentation: SegmentationFragment | undefined
): MarketMapData {
  const segmentByMarket = new Map<string, MarketSegment>();
  if (segmentation) {
    for (const m of segmentation.markets) segmentByMarket.set(m.market, m);
  }
  const markets: MapMarket[] = sourceMarket.markets.map((row) => {
    const obs2024 = row.observations.find((o) => o.year === 2024) ?? row.observations[0];
    const seg = segmentByMarket.get(row.market);
    return {
      market: row.market,
      geoName: GEO_NAME_OVERRIDES[row.market] ?? row.market,
      yieldRmPerVisitor: obs2024?.yield_rm_per_visitor ?? null,
      yieldYear: obs2024?.year ?? null,
      arrivals2024: obs2024?.arrivals_persons ?? null,
      coverage: row.coverage,
      clustered: seg?.clustered ?? false,
      segmentName: seg?.segment_name ?? null,
      tier: seg?.yield_tier ?? null,
      tierLabel: seg?.tier_label ?? null,
      excludedReason: seg?.excluded_reason ?? null,
    };
  });
  return {
    markets,
    missingFromGeometry: [],
    segmentationAvailable: segmentation !== undefined,
  };
}

/** Markets whose geo entity is absent from the committed world geometry. */
export function filterMissingFromGeometry(data: MarketMapData, geometryNames: Set<string>): string[] {
  return data.markets
    .filter((m) => !geometryNames.has(m.geoName))
    .map((m) => `${m.market} (as ${m.geoName})`);
}

// ---------------------------------------------------------------------------
// Method & sources index: every fragment -> its method, sources and links
// ---------------------------------------------------------------------------

export interface MethodSourceLink {
  label: string;
  url?: string;
}

export interface MethodEntry {
  fragment: string;
  ticket: string;
  method: string;
  sources: MethodSourceLink[];
  /** Where the dashboard renders this fragment's numbers (relative path). */
  usedBy: string[];
}

export function buildMethodIndex(bundle: Bundle): {
  bundleVersion: number;
  schemaVersion: string;
  generatedUtc: string;
  checksum: string;
  entries: MethodEntry[];
} {
  const f = bundle.fragments;
  const entries: MethodEntry[] = [];

  entries.push({
    fragment: "national_series",
    ticket: "T1",
    method:
      "Direct extraction from the DOSM Tourism Satellite Account workbooks (openpyxl). Each series states its counting basis (visitor / tourist / same-day visitor), window, unit and exact sheet row; the window is embedded in the series_id so mixed-basis series are impossible.",
    sources: f.national_series.series.map((s) => ({
      label: `${s.measure} (${s.basis} basis, ${s.window}) — DOSM TSA ${s.source.file}, sheet "${s.source.sheet}", row ${s.source.row} ("${s.source.row_label}")`,
    })),
    usedBy: ["/", "/diagnosis/decomposition"],
  });

  if (f.source_market) {
    entries.push({
      fragment: "source_market",
      ticket: "T3",
      method:
        "Top-20 per-market receipts and arrivals tables from the Tourism Malaysia Statistics in Brief 2024 PDF (pdftotext -layout), with per-market yield = receipts / arrivals. Markets missing from one table keep explicit nulls (never zeroed).",
      sources: [
        {
          label: `Tourism Malaysia Statistics in Brief 2024 — ${f.source_market.source_receipts.file}, table "${f.source_market.source_receipts.table}" (receipts)`,
        },
        {
          label: `Tourism Malaysia Statistics in Brief 2024 — ${f.source_market.source_arrivals.file}, table "${f.source_market.source_arrivals.table}" (arrivals)`,
          url: "https://data.tourism.gov.my/",
        },
      ],
      usedBy: ["/diagnosis/source-markets"],
    });
  }

  if (f.macro_series) {
    for (const s of f.macro_series.series) {
      entries.push({
        fragment: "macro_series",
        ticket: "T4",
        method: `National CPI (annual mean of the monthly index), downloaded via tools/dosm-cli on ${s.source.fetched_utc.slice(0, 10)}. The deflator for the constant-2019-prices counterfactual.`,
        sources: [{ label: `OpenDOSM dataset "${s.source.dataset_id}" — ${s.source.title} (${s.source.index_base}, fetched ${s.source.fetched_utc.slice(0, 10)})`, url: s.source.url }],
        usedBy: ["/", "/diagnosis/decomposition"],
      });
    }
  }

  if (f.missing_billions) {
    const mb = f.missing_billions;
    entries.push({
      fragment: "missing_billions",
      ticket: "T4",
      method: `The headline counterfactual in CONSTANT ${mb.anchor_year} PRICES ONLY: receipts at ${mb.anchor_year}'s real per-visitor expenditure, deflated by the national CPI (anchor index ${mb.deflator.anchor_index}, ${mb.deflator.index_base}). Sign convention: gap = counterfactual − actual; positive = missing billions. The naive nominal twin is emitted flagged INVALID.`,
      sources: [
        { label: `Receipts: ${mb.receipts_series_id} (DOSM TSA Jad 1A)` },
        { label: `Arrivals: ${mb.arrivals_series_id} (visitor basis)` },
        { label: `Deflator: ${mb.deflator.series_id} — ${mb.deflator.description}`, url: mb.deflator.source.url },
      ],
      usedBy: ["/", "/diagnosis/decomposition"],
    });
  }

  if (f.source_segmentation) {
    const seg = f.source_segmentation;
    entries.push({
      fragment: "source_segmentation",
      ticket: "T5",
      method: `${seg.method}, seed ${seg.seed}. Named by rule-based cluster profiles (never machine ids); tiers are quartiles of the same emitted 2024 yields. ${seg.naming_rationale}`,
      sources: [
        { label: "Yields and volumes: the source_market fragment (Tourism Malaysia In Brief 2024)" },
        {
          label: "WEF Travel & Tourism Development Index 2024 indicators (feature inputs)",
          url: "https://www.weforum.org/publications/travel-and-tourism-development-index-2024/",
        },
      ],
      usedBy: ["/diagnosis/source-markets"],
    });
  }

  if (f.source_segmentation) {
    entries.push({
      fragment: "per_market_prescriptions",
      ticket: "T10",
      method:
        "Derived, not modelled: every clustered source market gets exactly one verdict from its segment membership — grow (High-Yield Long-Haul or High-Growth Emerging: each extra visitor adds disproportionate value), coast (Low-Yield Steady: arrivals without matching value, so effort stays flat), reduce reliance on low-yield same-day traffic (Volume Traps). Volume Traps is a measurement critique of the arrivals KPI, not a judgement of the market. Unclustered markets get no verdict; a segment no rule covers is flagged, never guessed. The numbers behind each verdict (yield, arrivals, growth, tier) come straight from this fragment.",
      sources: [
        { label: "Segment membership, yield tiers and 2024 figures: the source_segmentation fragment (same page, above)" },
      ],
      usedBy: ["/diagnosis/source-markets"],
    });
  }

  if (f.regional_benchmark) {
    const rb = f.regional_benchmark;
    entries.push({
      fragment: "regional_benchmark",
      ticket: "T6",
      method: `2024 receipts-per-visitor for ${rb.countries.map((c) => c.country).join(", ")} vs each country's ${rb.baseline_year} WDI yield, from officially published releases. Basis caveats (survey vs balance-of-payments vs administrative) travel with every row. Supporting context only — never the headline.`,
      sources: rb.countries.flatMap((c) =>
        c.source_urls.map((u) => ({ label: `${c.country}: officially published 2024 figures (${c.receipts_basis_note})`, url: u }))
      ),
      usedBy: ["/diagnosis/regional"],
    });
  }

  return {
    bundleVersion: bundle.bundle_version,
    schemaVersion: bundle.schema_version,
    generatedUtc: bundle.generated_utc,
    checksum: bundle.checksum,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Honesty flags (ticket #18 — watch items carried from the #16 review)
// ---------------------------------------------------------------------------

/** The flag every nominal (non-price-adjusted) figure renders with. */
export const NOMINAL_FLAG = "INVALID — nominal (not price-adjusted)";

export interface FlaggedNominalFigure {
  /** The formatted figure itself (RM million, one decimal). */
  display: string;
  /** The flag text the page MUST render next to the figure. */
  flag: string;
  /** Why this figure is flagged — rendered with it, never stripped. */
  notice: string;
}

function fmtRmMillion(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} RM million`;
}

/**
 * Flag an arbitrary nominal figure. Honesty rule: wherever a nominal figure
 * appears, it renders with an explicit INVALID/flagged treatment — this
 * builder produces the flag so a page cannot forget it.
 */
export function flagNominalFigure(value: number, what: string): FlaggedNominalFigure {
  return {
    display: fmtRmMillion(value),
    flag: NOMINAL_FLAG,
    notice: `${what} is NOMINAL — ringgit of different years are not comparable, so it is flagged INVALID and is never a real-terms gap or comparison.`,
  };
}

/**
 * Ticket #18 watch item: `naive_nominal_gap_rm_million` is parsed from the
 * bundle and shows a false surplus (volume + inflation flatter it). It may
 * appear on a page ONLY through this builder, which carries the INVALID flag
 * and the false-surplus warning in its output.
 */
export function flagNaiveNominalGap(year: CounterfactualYear): FlaggedNominalFigure {
  const fig = flagNominalFigure(
    year.naive_nominal_gap_rm_million,
    `The naive nominal gap for ${yearLabel(year)}`
  );
  return {
    ...fig,
    notice: `The naive nominal gap for ${yearLabel(year)} (${fig.display}) is INVALID: it compares nominal ringgit across years. Inflation and visitor volume flatter it — per the bundle it shows a false surplus where the real (constant-2019-prices) gap is missing billions. Never read it as a comparison.`,
  };
}

/** The full naive-nominal twin series, for display in a flagged INVALID card. */
export function buildNaiveNominalGapSeries(frag: MissingBillionsFragment): {
  flag: string;
  notice: string;
  unit: string;
  points: [number, number | null][];
} {
  const years = [...frag.years].sort((a, b) => a.year - b.year);
  return {
    flag: NOMINAL_FLAG,
    notice:
      "The naive nominal gap — receipts minus receipts at 2019's NOMINAL per-visitor yield, in ringgit of each year — is INVALID as a value measure: inflation and visitor volume flatter it, and per the data it shows a false surplus where the real (constant-2019-prices) headline shows missing billions. Shown flagged so the error is visible, never as a comparison.",
    unit: "RM million (INVALID — nominal)",
    points: years.map((y) => [y.year, y.naive_nominal_gap_rm_million] as [number, number | null]),
  };
}

/**
 * Ticket #18 watch item: a nominal index/per-visitor series (e.g. "Receipts,
 * nominal RM (value — intensive side)") carries an explicit nominal-vs-real
 * label wherever it renders. Returns the label text, or null for real-terms
 * traces (which need no flag).
 */
export function nominalSeriesNotice(trace: Pick<DecompositionTrace, "name" | "kind" | "unit">): string | null {
  if (!/nominal/i.test(trace.name)) return null;
  if (trace.kind === "index") {
    return `${trace.name} — explicitly NOMINAL, not price-adjusted: an index of the intensive side in ringgit of each year. It is not a gap and not comparable against the real-2019 series (INVALID as a value measure).`;
  }
  return `${trace.name} — explicitly NOMINAL, not price-adjusted: ringgit of different years are not comparable (INVALID as a value measure). Read the real-2019 series for what a visitor is worth in 2019 money.`;
}

// ---------------------------------------------------------------------------
// Source-market ranking + shading (ticket #18)
// ---------------------------------------------------------------------------

/** Markets ranked by 2024 tourism yield (highest first); null yields last. */
export function buildMarketRanking(data: MarketMapData): RankedMarket[] {
  return [...data.markets]
    .sort((a, b) => (b.yieldRmPerVisitor ?? -Infinity) - (a.yieldRmPerVisitor ?? -Infinity))
    .map((m, i) => ({ ...m, rank: m.yieldRmPerVisitor === null ? null : i + 1 }));
}

/** The ranked row type: `rank` is null exactly when the yield is null. */
export type RankedMarket = MapMarket & { rank: number | null };

export type YieldShade =
  | "tier_top"
  | "tier_upper"
  | "tier_lower"
  | "tier_bottom"
  | "unclustered"
  | "no_yield";

/**
 * Map shade from the pipeline's own yield tier (quartiles of the emitted 2024
 * yields — the same tiers the report cites). Markets with a yield but no
 * segmentation row shade "unclustered"; no yield means no shade.
 */
export function yieldShade(market: MapMarket): YieldShade {
  switch (market.tier) {
    case "top_quartile":
      return "tier_top";
    case "upper_middle":
      return "tier_upper";
    case "lower_middle":
      return "tier_lower";
    case "bottom_quartile":
      return "tier_bottom";
  }
  return market.yieldRmPerVisitor === null ? "no_yield" : "unclustered";
}

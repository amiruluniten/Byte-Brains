/**
 * Bundle loader and validator (schema 1.1.0) — the dashboard side of the single
 * seam. Mirrors the pipeline contract in
 * pipeline/src/bytebrains_pipeline/bundle/models.py:
 *
 * - strict fragment/series shape,
 * - series_id must embed its window (counting-basis discipline),
 * - years strictly ascending without duplicates,
 * - sha256 checksum over canonical JSON (sorted keys, compact separators,
 *   non-ASCII kept literal) of {bundle_version, schema_version, sources,
 *   fragments} — the same bytes the Python emitter hashes.
 *
 * Any failure raises BundleLoadError with a message a maintainer can act on.
 * A corrupt or missing bundle must fail loudly, never render a blank page.
 */
import { createHash } from "node:crypto";
import type { SimulatorFragment, SimulatorMarket } from "./simulator";

export const BUNDLE_VERSION = 1;
export const SCHEMA_VERSION = "1.1.0";
/** Ticket #13: the headline window is pre-registered — it must never move. */
export const PRE_REGISTERED_HEADLINE_WINDOW = "2020-2024";

export type Basis = "visitor" | "tourist" | "excursionist";

/**
 * The one basis→label map (ticket #21). CONTEXT.md vocabulary: "same-day
 * visitor" is the prose word; the long form keeps the technical
 * "excursionist" token visible in labels.
 */
export const BASIS_LABELS: Record<Basis, { word: string; long: string }> = {
  visitor: { word: "Visitor", long: "visitor" },
  tourist: { word: "Tourist", long: "tourist" },
  excursionist: { word: "Same-day visitor", long: "same-day visitor (excursionist)" },
};
export type Unit = "persons" | "rm_million" | "percent";
export type Measure = "arrivals" | "inbound_tourism_consumption";

export interface SourceRef {
  file: string;
  sheet: string;
  row_label: string;
  row: number;
}

export type RevisionStatus = "final" | "revised" | "preliminary";

/**
 * The one "2025p" preliminary-suffix helper (ticket #21): a preliminary
 * observation is always labelled `${year}p`, never quoted as final data.
 */
export function yearLabel(o: Pick<Observation, "year"> & { revision_status?: RevisionStatus }): string {
  return o.revision_status === "preliminary" ? `${o.year}p` : String(o.year);
}

export interface Observation {
  year: number;
  value: number | null; // null where DOSM prints a footnote (n.a) instead of a number
  revision_flag?: string | null; // e.g. "p" from a "2025p" year header
  revision_status?: RevisionStatus; // ticket #13: final / revised / preliminary
}

export interface Series {
  series_id: string;
  measure: string;
  basis: Basis;
  unit: Unit;
  window: string; // "2015-2023" — stated explicitly, never inferred from values
  source: SourceRef;
  values: Observation[];
}

export interface Bundle {
  bundle_version: number;
  schema_version: string;
  generated_utc: string;
  sources: Record<string, string>; // file name -> sha256 of the raw file bytes
  fragments: {
    national_series: { series: Series[] };
    /** Optional fragments: present when the pipeline emitted them. */
    source_market?: SourceMarketFragment;
    macro_series?: MacroSeriesFragment;
    missing_billions?: MissingBillionsFragment;
    source_segmentation?: SegmentationFragment;
    regional_benchmark?: RegionalBenchmarkFragment;
    /** Ticket T7: client-side market-mix coefficients (constant 2019 prices). */
    simulator?: SimulatorFragment;
  };
  checksum: string;
}

export class BundleLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BundleLoadError";
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(msg: string): never {
  throw new BundleLoadError(msg);
}

function asString(v: unknown, what: string): string {
  if (typeof v !== "string") fail(`bundle field ${what} must be a string`);
  return v;
}

/**
 * Shared union-literal validator (ticket #21): `v` must be one of `allowed`.
 * Every union-literal cascade in the parser funnels through here so the
 * "must be a | b | c" wording exists in exactly one place.
 */
function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    fail(`${what} must be ${allowed.join(" | ")}, got ${String(v)}`);
  }
  return v as T;
}

/** Shared duplicate detection (ticket #21): the values that appear more than once. */
function duplicates(values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) !== i);
}

/** A closed [from, to] year window, parsed from a bundle's "YYYY-YYYY" string. */
export interface Window {
  from: number;
  to: number;
}

/**
 * Own the "YYYY-YYYY" window-string parsing (ticket #21): every window split
 * in the dashboard goes through here, so the format is checked in one place.
 */
export function parseWindow(w: string, what: string): Window {
  const [from, to] = w.split("-").map((x) => Number(x));
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
    fail(`${what} must be a "YYYY-YYYY" window with from <= to, got ${String(w)}`);
  }
  return { from, to };
}

/**
 * Counting-basis discipline: the window is embedded in the series_id, so a
 * mixed-basis series cannot be constructed silently. Shared by the national
 * and macro series parsers (ticket #21).
 */
function requireSeriesIdEmbedsWindow(seriesId: string, window: string, where: string): void {
  if (!seriesId.includes(window.replace("-", "_"))) {
    fail(`${where}: series_id must embed its window ${window}`);
  }
}

// ---------------------------------------------------------------------------
// Canonical JSON — byte-compatible with the Python emitter's
// json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False).
//
// Python prints its floats as repr(): integral floats keep a trailing ".0"
// ("25721251.0") while ints print bare ("2015"). JSON.parse collapses both to
// the same JS number, so we parse with a tagged parser that records each
// number's int/float token type and re-serialize accordingly.
//
// Limitation (documented): floats needing scientific notation (|x| >= 1e16 or
// < 1e-4) format differently in Python ("1e+16", "1e-05" with padded
// exponent) than in JS. Tourism values here are counts and RM millions well
// inside the plain-decimal range; if the bundle ever grows such magnitudes,
// revisit fmtFloat.
// ---------------------------------------------------------------------------

type Tagged =
  | { t: "int"; v: number }
  | { t: "float"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "null" }
  | { t: "arr"; v: Tagged[] }
  | { t: "obj"; v: [string, Tagged][] };

class TaggedParseError extends Error {}

function parseTagged(text: string): Tagged {
  let i = 0;

  function failParse(msg: string): never {
    throw new TaggedParseError(`${msg} at offset ${i}`);
  }

  function ws(): void {
    while (i < text.length && /\s/.test(text[i])) i++;
  }

  function str(): string {
    // text[i] === '"'; find the closing quote respecting escapes, then reuse
    // JSON.parse for exact escape handling.
    let j = i + 1;
    while (j < text.length && text[j] !== '"') {
      if (text[j] === "\\") j += 2;
      else j++;
    }
    if (j >= text.length) failParse("unterminated string");
    const s = JSON.parse(text.slice(i, j + 1)) as string;
    i = j + 1;
    return s;
  }

  function value(): Tagged {
    ws();
    if (i >= text.length) failParse("unexpected end of input");
    const c = text[i];
    if (c === "{") {
      i++;
      const pairs: [string, Tagged][] = [];
      ws();
      if (text[i] === "}") {
        i++;
        return { t: "obj", v: pairs };
      }
      for (;;) {
        ws();
        if (text[i] !== '"') failParse("expected object key");
        const k = str();
        ws();
        if (text[i] !== ":") failParse("expected ':'");
        i++;
        pairs.push([k, value()]);
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "}") {
          i++;
          return { t: "obj", v: pairs };
        }
        failParse("expected ',' or '}'");
      }
    }
    if (c === "[") {
      i++;
      const items: Tagged[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return { t: "arr", v: items };
      }
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === "]") {
          i++;
          return { t: "arr", v: items };
        }
        failParse("expected ',' or ']'");
      }
    }
    if (c === '"') return { t: "str", v: str() };
    if (text.startsWith("true", i)) {
      i += 4;
      return { t: "bool", v: true };
    }
    if (text.startsWith("false", i)) {
      i += 5;
      return { t: "bool", v: false };
    }
    if (text.startsWith("null", i)) {
      i += 4;
      return { t: "null" };
    }
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) failParse("unexpected token");
    const token = m[0];
    i += token.length;
    const isFloat = /[.eE]/.test(token);
    const n = Number(token);
    if (Number.isNaN(n)) failParse(`bad number ${token}`);
    return isFloat ? { t: "float", v: n } : { t: "int", v: n };
  }

  const out = value();
  ws();
  if (i !== text.length) failParse("trailing content after JSON value");
  return out;
}

function fmtFloat(v: number): string {
  if (Number.isInteger(v)) return `${v.toString()}.0`;
  return v.toString(); // JS shortest round-trip == Python repr in plain-decimal range
}

function canonical(n: Tagged): string {
  switch (n.t) {
    case "int":
      return String(n.v);
    case "float":
      return fmtFloat(n.v);
    case "str":
      return JSON.stringify(n.v);
    case "bool":
      return n.v ? "true" : "false";
    case "null":
      return "null";
    case "arr":
      return `[${n.v.map(canonical).join(",")}]`;
    case "obj": {
      // Python keeps the last value for duplicate keys; sort keys for output.
      const last = new Map<string, Tagged>();
      for (const [k, v] of n.v) last.set(k, v);
      const keys = [...last.keys()].sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(last.get(k) as Tagged)}`).join(",")}}`;
    }
  }
}

function canonicalJson(raw: string): string {
  return canonical(parseTagged(raw));
}

function verifyChecksum(raw: string, recorded: unknown): void {
  if (typeof recorded !== "string" || recorded.length === 0) {
    fail("bundle has no checksum; refusing to load an unverifiable bundle");
  }
  const root = parseTagged(raw);
  if (root.t !== "obj") fail("data bundle must be a JSON object");
  const pick = (key: string): Tagged => {
    let found: Tagged | undefined;
    for (const [k, v] of root.v) if (k === key) found = v;
    return found ?? { t: "null" };
  };
  // The emitter hashes exactly {bundle_version, schema_version, sources,
  // fragments}; generated_utc and checksum itself are excluded.
  const payload: Tagged = {
    t: "obj",
    v: [
      ["bundle_version", pick("bundle_version")],
      ["schema_version", pick("schema_version")],
      ["sources", pick("sources")],
      ["fragments", pick("fragments")],
    ],
  };
  const computed = createHash("sha256")
    .update(canonical(payload), "utf8")
    .digest("hex");
  if (computed !== recorded) {
    fail(
      `checksum mismatch: recorded ${recorded}, computed ${computed} — the bundle is corrupted or was tampered with`
    );
  }
}

function parseObservation(v: unknown, where: string): Observation {
  if (!isObject(v)) fail(`${where}: observation must be an object`);
  const year = v.year;
  if (typeof year !== "number" || !Number.isInteger(year)) {
    fail(`${where}: observation year must be an integer`);
  }
  const value = v.value;
  if (value !== null && typeof value !== "number") {
    fail(`${where}: observation value must be a number or null (n.a footnote)`);
  }
  const revision = v.revision_flag;
  if (revision !== null && revision !== undefined && typeof revision !== "string") {
    fail(`${where}: revision_flag must be a string, null, or absent`);
  }
  const out: Observation = { year, value };
  if (revision !== undefined) out.revision_flag = revision;
  const status = v.revision_status;
  if (status !== undefined && status !== null) {
    out.revision_status = oneOf(status, ["final", "revised", "preliminary"] as const, `${where}.revision_status`);
  }
  return out;
}

function parseSeries(v: unknown, index: number): Series {
  const where = `fragments.national_series.series[${index}]`;
  if (!isObject(v)) fail(`${where} must be an object`);
  const seriesId = asString(v.series_id, `${where}.series_id`);
  const w = `${where} (${seriesId})`;
  const measure = asString(v.measure, `${w}.measure`);
  const basis = oneOf(v.basis, ["visitor", "tourist", "excursionist"] as const, `${w}.basis`);
  const unit = oneOf(v.unit, ["persons", "rm_million", "percent"] as const, `${w}.unit`);
  const window = asString(v.window, `${w}.window`);

  const src = v.source;
  if (!isObject(src)) fail(`${w}: source must be an object`);
  const source: SourceRef = {
    file: asString(src.file, `${w}.source.file`),
    sheet: asString(src.sheet, `${w}.source.sheet`),
    row_label: asString(src.row_label, `${w}.source.row_label`),
    row: typeof src.row === "number" ? src.row : fail(`${w}.source.row must be a number`),
  };

  if (!Array.isArray(v.values) || v.values.length === 0) {
    fail(`${w}: values must be a non-empty array`);
  }
  const values = v.values.map((o, i) => parseObservation(o, `${w}.values[${i}]`));

  const years = values.map((o) => o.year);
  for (let i = 1; i < years.length; i++) {
    if (years[i] <= years[i - 1]) {
      fail(`${w}: years must be strictly ascending without duplicates, got ${years.join(",")}`);
    }
  }

  requireSeriesIdEmbedsWindow(seriesId, window, w);

  return {
    series_id: seriesId,
    measure,
    basis,
    unit,
    window,
    source,
    values,
  };
}

export function loadBundleFromString(raw: string): Bundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`data bundle is not valid JSON: ${(e as Error).message}`);
  }
  if (!isObject(parsed)) fail("data bundle must be a JSON object");

  if (parsed.bundle_version !== BUNDLE_VERSION) {
    fail(
      `unsupported bundle_version ${String(parsed.bundle_version)} (expected ${BUNDLE_VERSION})`
    );
  }
  const schemaVersion = asString(parsed.schema_version, "schema_version");
  if (!/^\d+\.\d+\.\d+$/.test(schemaVersion)) {
    fail(`schema_version must be semver, got ${schemaVersion}`);
  }

  verifyChecksum(raw, parsed.checksum);

  const fragments = parsed.fragments;
  if (!isObject(fragments)) fail("fragments must be an object");
  const national = fragments.national_series;
  if (!isObject(national)) fail("bundle is missing the national_series fragment");
  if (!Array.isArray(national.series) || national.series.length === 0) {
    fail("national_series.series must be a non-empty array");
  }

  const series = national.series.map(parseSeries);
  const dupes = duplicates(series.map((s) => s.series_id));
  if (dupes.length > 0) {
    fail(`duplicate series_id: ${[...new Set(dupes)].join(", ")}`);
  }

  return {
    bundle_version: parsed.bundle_version,
    schema_version: schemaVersion,
    generated_utc: asString(parsed.generated_utc, "generated_utc"),
    sources: parsed.sources as Record<string, string>,
    fragments: {
      national_series: { series },
      source_market: parseSourceMarketFragment(fragments.source_market),
      macro_series: parseMacroSeriesFragment(fragments.macro_series),
      missing_billions: parseMissingBillionsFragment(fragments.missing_billions),
      source_segmentation: parseSegmentationFragment(fragments.source_segmentation),
      regional_benchmark: parseRegionalBenchmarkFragment(fragments.regional_benchmark),
      simulator: parseSimulatorFragment(fragments.simulator),
    },
    checksum: parsed.checksum as string,
  };
}

// ---------------------------------------------------------------------------
// Ticket T7: the `simulator` fragment (schema 1.1.0: lives inside
// `fragments`, not at the top level) — client-side market-mix coefficients
// (constant 2019 prices). Mirrors the pydantic invariants in
// pipeline/src/bytebrains_pipeline/bundle/models.py::SimulatorFragment.
// ---------------------------------------------------------------------------

function parseSimulatorMarket(v: unknown, where: string): SimulatorMarket {
  if (!isObject(v)) fail(`${where} must be an object`);
  const market = asString(v.market, `${where}.market`);
  const w = `${where} (${market})`;
  const coverage = oneOf(v.coverage, ["both", "residual"] as const, `${w}.coverage`);
  const yieldReal = v.yield_2024_real_2019_rm_per_visitor;
  if (typeof yieldReal !== "number") {
    fail(`${w}: yield_2024_real_2019_rm_per_visitor must be a number`);
  }
  const nominal = v.yield_2024_nominal_rm_per_visitor;
  if (nominal !== null && typeof nominal !== "number") {
    fail(`${w}: yield_2024_nominal_rm_per_visitor must be a number or null`);
  }
  if (coverage === "residual") {
    if (nominal !== null && nominal !== undefined) {
      fail(`${w}: the residual row has no observable nominal yield; must be null`);
    }
    if (yieldReal <= 0) {
      fail(`${w}: non-positive residual real yield — re-derive the residual upstream`);
    }
  } else if (typeof nominal !== "number") {
    fail(`${w}: coverage "both" needs a nominal yield`);
  }
  return {
    market,
    coverage,
    yield_2024_nominal_rm_per_visitor: nominal ?? null,
    yield_2024_real_2019_rm_per_visitor: yieldReal,
    arrivals_2024_persons: asPositiveInt(v.arrivals_2024_persons, `${w}.arrivals_2024_persons`),
    arrivals_2023_persons: asPositiveInt(v.arrivals_2023_persons, `${w}.arrivals_2023_persons`),
    share_of_arrivals_2024: asNumber(v.share_of_arrivals_2024, `${w}.share_of_arrivals_2024`),
    share_of_arrivals_2023: asNumber(v.share_of_arrivals_2023, `${w}.share_of_arrivals_2023`),
  };
}

function asNumber(v: unknown, what: string): number {
  if (typeof v !== "number") fail(`${what} must be a number`);
  return v;
}

function asPositiveInt(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    fail(`${what} must be a positive integer`);
  }
  return v;
}

function parseSimulatorFragment(v: unknown): SimulatorFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.simulator";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (v.prices !== "constant_2019_rm") {
    fail(`${where}.prices must be "constant_2019_rm" (the simulator is real-terms only)`);
  }
  const anchorYear = asNumber(v.anchor_year, `${where}.anchor_year`);
  const mixYear = asNumber(v.mix_year, `${where}.mix_year`);
  const comparisonYear = asNumber(v.comparison_year, `${where}.comparison_year`);
  if (anchorYear !== 2019 || mixYear !== 2024 || comparisonYear !== 2023) {
    fail(`${where}: simulator years are (anchor, comparison, mix) = (2019, 2023, 2024) by contract`);
  }
  const ratio = asNumber(v.cpi_ratio_to_anchor_mix_year, `${where}.cpi_ratio_to_anchor_mix_year`);
  const anchorYield = asNumber(
    v.anchor_per_visitor_real_2019_rm,
    `${where}.anchor_per_visitor_real_2019_rm`
  );
  const visitors24 = asPositiveInt(v.visitor_arrivals_2024, `${where}.visitor_arrivals_2024`);
  const visitors23 = asPositiveInt(v.visitor_arrivals_2023, `${where}.visitor_arrivals_2023`);
  if (!Array.isArray(v.markets) || v.markets.length < 2) {
    fail(`${where}.markets must have at least 2 rows (one residual partitions the national totals)`);
  }
  const markets = v.markets.map((m, i) => parseSimulatorMarket(m, `${where}.markets[${i}]`));
  const residuals = markets.filter((m) => m.coverage === "residual");
  if (residuals.length !== 1) {
    fail(`${where}: exactly one residual row is required, got ${residuals.length}`);
  }
  for (const year of [2024, 2023] as const) {
    const arrivalsKey = year === 2024 ? "arrivals_2024_persons" : "arrivals_2023_persons";
    const shareKey = year === 2024 ? "share_of_arrivals_2024" : "share_of_arrivals_2023";
    const visitors = year === 2024 ? visitors24 : visitors23;
    const arrivalsSum = markets.reduce((sum, m) => sum + m[arrivalsKey], 0);
    if (arrivalsSum !== visitors) {
      fail(
        `${where}: ${year} market arrivals must sum exactly to the national visitor arrivals ` +
          `(${arrivalsSum} != ${visitors})`
      );
    }
    const shareSum = markets.reduce((sum, m) => sum + m[shareKey], 0);
    if (Math.abs(shareSum - 1) > 1e-9) {
      fail(`${where}: ${year} shares must sum to 1, got ${shareSum}`);
    }
  }
  // deflation discipline: real yield = nominal / cpi_ratio for observable rows
  for (const m of markets) {
    if (m.coverage === "both" && m.yield_2024_nominal_rm_per_visitor !== null) {
      const expectedReal = m.yield_2024_nominal_rm_per_visitor / ratio;
      if (Math.abs(m.yield_2024_real_2019_rm_per_visitor - expectedReal) > 1e-9) {
        fail(`${where} (${m.market}): real yield is not the nominal yield deflated by the CPI ratio`);
      }
    }
  }
  return {
    prices: "constant_2019_rm",
    anchor_year: anchorYear,
    mix_year: mixYear,
    comparison_year: comparisonYear,
    cpi_series_id: asString(v.cpi_series_id, `${where}.cpi_series_id`),
    cpi_ratio_to_anchor_mix_year: ratio,
    visitor_arrivals_2024: visitors24,
    visitor_arrivals_2023: visitors23,
    anchor_per_visitor_real_2019_rm: anchorYield,
    markets,
  };
}


// ---------------------------------------------------------------------------
// The optional fragments. The emitter may not include every
// fragment (e.g. source_segmentation needs the WEF TTDI file), so each parser
// returns undefined for an absent fragment and FAILS LOUDLY for a present but
// malformed one. Pages degrade gracefully on undefined, never on bad data.
// Mirrors pipeline/src/bytebrains_pipeline/bundle/models.py (schema 1.1.0 —
// additive extensions over 1.0.0: observation revision_status, the guarded
// missing_billions headline + labelled supplementary, the simulator fragment
// inside `fragments`, segmentation provenance/features/WEF fields).
// ---------------------------------------------------------------------------

export interface TextSourceRef {
  file: string;
  table: string;
  page?: number | null;
}

export interface MarketObservation {
  year: number;
  receipts_rm_million?: number | null;
  arrivals_persons?: number | null;
  receipts_rank?: number | null;
  arrivals_rank?: number | null;
  yield_rm_per_visitor?: number | null;
}

export interface SourceMarketRow {
  market: string;
  coverage: "both" | "arrivals_only" | "receipts_only";
  observations: MarketObservation[];
}

export interface SourceMarketFragment {
  source_receipts: TextSourceRef;
  source_arrivals: TextSourceRef;
  national_totals: MarketObservation[];
  markets: SourceMarketRow[];
}

export interface MacroSource {
  dataset_id: string;
  title: string;
  url: string;
  fetched_utc: string;
  index_base: string;
}

export interface MacroSeries {
  series_id: string;
  measure: string;
  unit: "index";
  window: string;
  source: MacroSource;
  values: Observation[];
}

export interface MacroSeriesFragment {
  series: MacroSeries[];
}

export interface DeflatorMeta {
  series_id: string;
  description: string;
  anchor_year: number;
  anchor_index: number;
  index_base: string;
  source: MacroSource;
}

export interface CounterfactualYear {
  year: number;
  visitor_arrivals: number;
  receipts_nominal_rm_million: number;
  per_visitor_nominal_rm: number;
  cpi_index: number;
  cpi_ratio_to_anchor: number;
  per_visitor_real_2019_rm: number;
  actual_receipts_2019_prices_rm_million: number;
  counterfactual_receipts_2019_prices_rm_million: number;
  gap_2019_prices_rm_million: number;
  naive_nominal_gap_rm_million: number;
  revision_status: RevisionStatus; // ticket #13: the 2025 row is "preliminary"
}

/** Ticket #13: the pre-registered, window-guarded headline (no result-shopping). */
export interface HeadlineGap {
  window: string;
  prices: "constant_2019_rm";
  cumulative_gap_rm_million: number;
  pre_registered: true;
  basis_note: string;
}

/** Ticket #13: a cumulative BEYOND the headline window — labelled, never the headline. */
export interface SupplementaryCumulative {
  window: string;
  label: string; // must contain "supplementary"
  cumulative_gap_rm_million: number;
}

export interface VolumeTrap {
  excursionist_share_2019_pct: number;
  excursionist_share_2024_pct: number;
  excursionist_share_change_pp: number;
  land_mode_share_2024_pct: number;
  land_mode_share_source: string;
}

export interface MissingBillionsFragment {
  anchor_year: number;
  prices: "constant_2019_rm";
  receipts_series_id: string;
  arrivals_series_id: string;
  cpi_series_id: string;
  deflator: DeflatorMeta;
  years: CounterfactualYear[];
  volume_trap: VolumeTrap;
  headline: HeadlineGap;
  supplementary?: SupplementaryCumulative | null;
}

export type YieldTier = "top_quartile" | "upper_middle" | "lower_middle" | "bottom_quartile";

/** Schema 1.1.0: documented clustering feature. */
export interface FeatureDef {
  name: string;
  description: string;
  unit: string;
  source: string;
  transform: string;
  imputation: string;
}

/** Schema 1.1.0: provenance of the segmentation inputs. */
export interface SegmentationSource {
  market_source_file: string;
  wef_file: string;
  wef_dataset: string;
  wef_url: string;
  wef_ref_year: number;
}

export interface MarketSegment {
  market: string;
  clustered: boolean;
  excluded_reason?: string | null;
  yield_rm_per_visitor_2024?: number | null;
  arrivals_persons_2024?: number | null;
  arrivals_growth_pct?: number | null;
  /** Schema 1.1.0: WEF TTDI feature inputs (None = missing, never zeroed). */
  wef_indicators?: Record<string, number | null>;
  wef_missing?: string[];
  wef_ref_years?: Record<string, number>;
  cluster_id?: number | null;
  segment_name?: string | null;
  yield_tier?: YieldTier | null;
  tier_label?: string | null;
}

export interface ClusterProfile {
  cluster_id: number;
  segment_name: string;
  naming_rationale: string;
  members: string[];
  mean_yield_rm_per_visitor: number;
}

export interface SegmentationFragment {
  anchor_year: number;
  method: string;
  seed: number;
  n_clusters: number;
  naming_rationale: string;
  /** Schema 1.1.0: explicit input provenance + the documented feature contract. */
  source: SegmentationSource;
  features: FeatureDef[];
  markets: MarketSegment[];
  clusters: ClusterProfile[];
  tier_labels: Record<YieldTier, string>;
  yield_quartile_boundaries: Record<string, number>;
}

export type ReceiptsBasis = "survey" | "balance_of_payments" | "administrative_aggregate";

export interface RegionalReceipts {
  local_amount_billion?: number | null;
  local_currency?: string | null;
  usd_billion: number;
  usd_note: string;
}

export interface RegionalCountry {
  country: string;
  role: "baseline" | "comparator";
  receipts_basis: ReceiptsBasis;
  receipts_basis_note: string;
  arrivals_2024: number;
  receipts_2024: RegionalReceipts;
  yield_2024_usd_per_visitor: number;
  yield_2019_usd_per_visitor: number;
  yield_change_2024_vs_2019_pct: number;
  yield_multiple_of_malaysia_2024?: number | null;
  source_urls: string[];
}

export interface ExcludedMarket {
  country: string;
  reason: string;
}

export interface RegionalBenchmarkFragment {
  anchor_year: number;
  baseline_year: number;
  currency: "usd";
  baseline_market: string;
  countries: RegionalCountry[];
  excluded_markets: ExcludedMarket[];
  caveats: string[];
  research_doc: string;
}

function optNum(v: unknown, what: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number") fail(`${what} must be a number or null`);
  return v;
}

function parseTextSourceRef(v: unknown, where: string): TextSourceRef {
  if (!isObject(v)) fail(`${where} must be an object`);
  return {
    file: asString(v.file, `${where}.file`),
    table: asString(v.table, `${where}.table`),
    ...(v.page === undefined ? {} : { page: optNum(v.page, `${where}.page`) }),
  };
}

function parseMarketObservation(v: unknown, where: string): MarketObservation {
  if (!isObject(v)) fail(`${where} must be an object`);
  if (typeof v.year !== "number") fail(`${where}.year must be a number`);
  return {
    year: v.year,
    receipts_rm_million: optNum(v.receipts_rm_million, `${where}.receipts_rm_million`),
    arrivals_persons: optNum(v.arrivals_persons, `${where}.arrivals_persons`),
    receipts_rank: optNum(v.receipts_rank, `${where}.receipts_rank`),
    arrivals_rank: optNum(v.arrivals_rank, `${where}.arrivals_rank`),
    yield_rm_per_visitor: optNum(v.yield_rm_per_visitor, `${where}.yield_rm_per_visitor`),
  };
}

function parseSourceMarketFragment(v: unknown): SourceMarketFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.source_market";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (!Array.isArray(v.markets) || v.markets.length === 0) {
    fail(`${where}.markets must be a non-empty array`);
  }
  if (!Array.isArray(v.national_totals) || v.national_totals.length === 0) {
    fail(`${where}.national_totals must be a non-empty array`);
  }
  const markets: SourceMarketRow[] = v.markets.map((m, i) => {
    const w = `${where}.markets[${i}]`;
    if (!isObject(m)) fail(`${w} must be an object`);
    const coverage = oneOf(m.coverage, ["both", "arrivals_only", "receipts_only"] as const, `${w}.coverage`);
    if (!Array.isArray(m.observations) || m.observations.length === 0) {
      fail(`${w}.observations must be a non-empty array`);
    }
    return {
      market: asString(m.market, `${w}.market`),
      coverage,
      observations: m.observations.map((o, j) => parseMarketObservation(o, `${w}.observations[${j}]`)),
    };
  });
  const dupes = duplicates(markets.map((m) => m.market));
  if (dupes.length > 0) fail(`${where}: duplicate source market ${[...new Set(dupes)].join(", ")}`);
  return {
    source_receipts: parseTextSourceRef(v.source_receipts, `${where}.source_receipts`),
    source_arrivals: parseTextSourceRef(v.source_arrivals, `${where}.source_arrivals`),
    national_totals: v.national_totals.map((o, i) => parseMarketObservation(o, `${where}.national_totals[${i}]`)),
    markets,
  };
}

function parseMacroSource(v: unknown, where: string): MacroSource {
  if (!isObject(v)) fail(`${where} must be an object`);
  return {
    dataset_id: asString(v.dataset_id, `${where}.dataset_id`),
    title: asString(v.title, `${where}.title`),
    url: asString(v.url, `${where}.url`),
    fetched_utc: asString(v.fetched_utc, `${where}.fetched_utc`),
    index_base: asString(v.index_base, `${where}.index_base`),
  };
}

function parseMacroSeriesFragment(v: unknown): MacroSeriesFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.macro_series";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (!Array.isArray(v.series) || v.series.length === 0) fail(`${where}.series must be a non-empty array`);
  return {
    series: v.series.map((s, i) => {
      const w = `${where}.series[${i}]`;
      if (!isObject(s)) fail(`${w} must be an object`);
      if (s.unit !== "index") fail(`${w}.unit must be "index"`);
      const window = asString(s.window, `${w}.window`);
      const seriesId = asString(s.series_id, `${w}.series_id`);
      requireSeriesIdEmbedsWindow(seriesId, window, w);
      if (!Array.isArray(s.values) || s.values.length === 0) fail(`${w}.values must be a non-empty array`);
      return {
        series_id: seriesId,
        measure: asString(s.measure, `${w}.measure`),
        unit: "index" as const,
        window,
        source: parseMacroSource(s.source, `${w}.source`),
        values: s.values.map((o, j) => parseObservation(o, `${w}.values[${j}]`)),
      };
    }),
  };
}

function parseMissingBillionsFragment(v: unknown): MissingBillionsFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.missing_billions";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (v.prices !== "constant_2019_rm") {
    fail(`${where}.prices must be "constant_2019_rm" — the headline counterfactual is real-terms only`);
  }
  if (!Array.isArray(v.years) || v.years.length === 0) fail(`${where}.years must be a non-empty array`);
  const years: CounterfactualYear[] = v.years.map((y, i) => {
    const w = `${where}.years[${i}]`;
    if (!isObject(y)) fail(`${w} must be an object`);
    const num = (k: string): number => {
      if (typeof y[k] !== "number") fail(`${w}.${k} must be a number`);
      return y[k] as number;
    };
    const status: RevisionStatus = y.revision_status === undefined || y.revision_status === null
      ? "final"
      : oneOf(y.revision_status, ["final", "revised", "preliminary"] as const, `${w}.revision_status`);
    return {
      year: num("year"),
      visitor_arrivals: num("visitor_arrivals"),
      receipts_nominal_rm_million: num("receipts_nominal_rm_million"),
      per_visitor_nominal_rm: num("per_visitor_nominal_rm"),
      cpi_index: num("cpi_index"),
      cpi_ratio_to_anchor: num("cpi_ratio_to_anchor"),
      per_visitor_real_2019_rm: num("per_visitor_real_2019_rm"),
      actual_receipts_2019_prices_rm_million: num("actual_receipts_2019_prices_rm_million"),
      counterfactual_receipts_2019_prices_rm_million: num("counterfactual_receipts_2019_prices_rm_million"),
      gap_2019_prices_rm_million: num("gap_2019_prices_rm_million"),
      naive_nominal_gap_rm_million: num("naive_nominal_gap_rm_million"),
      revision_status: status,
    };
  });
  const vt = v.volume_trap;
  if (!isObject(vt)) fail(`${where}.volume_trap must be an object`);
  const vtNum = (k: string): number => {
    if (typeof vt[k] !== "number") fail(`${where}.volume_trap.${k} must be a number`);
    return vt[k] as number;
  };
  // ticket #13: the pre-registered headline guard. What is fixed is the WINDOW
  // (2020-2024, fixed before the TSA 2025 release was examined); the value
  // follows the revision policy and equals the sum of the fragment's own rows.
  const headlineV = v.headline;
  if (!isObject(headlineV)) fail(`${where}.headline must be an object`);
  if (headlineV.prices !== "constant_2019_rm") {
    fail(`${where}.headline.prices must be "constant_2019_rm"`);
  }
  if (headlineV.pre_registered !== true) {
    fail(`${where}.headline.pre_registered must be true`);
  }
  const headline: HeadlineGap = {
    window: asString(headlineV.window, `${where}.headline.window`),
    prices: "constant_2019_rm",
    cumulative_gap_rm_million: asNumber(
      headlineV.cumulative_gap_rm_million,
      `${where}.headline.cumulative_gap_rm_million`
    ),
    pre_registered: true,
    basis_note: asString(headlineV.basis_note, `${where}.headline.basis_note`),
  };
  if (headline.window !== PRE_REGISTERED_HEADLINE_WINDOW) {
    fail(
      `${where}: headline window ${headline.window} violates the pre-registered contract ` +
        `(expected ${PRE_REGISTERED_HEADLINE_WINDOW}) — result-shopping guard`
    );
  }
  // headline value must equal the sum of its own window's rows (revision policy)
  const headlineWindow = parseWindow(headline.window, `${where}.headline.window`);
  const headlineSum = years
    .filter((y) => y.year >= headlineWindow.from && y.year <= headlineWindow.to)
    .reduce((s, y) => s + y.gap_2019_prices_rm_million, 0);
  if (Math.abs(headlineSum - headline.cumulative_gap_rm_million) > 1e-6) {
    fail(
      `${where}: headline cumulative gap ${headline.cumulative_gap_rm_million} does not equal ` +
        `the sum of the fragment's ${headline.window} rows (${headlineSum})`
    );
  }
  // ticket #13: the supplementary cumulative is labelled, and never the headline
  let supplementary: SupplementaryCumulative | null = null;
  if (v.supplementary !== undefined && v.supplementary !== null) {
    const sup = v.supplementary;
    if (!isObject(sup)) fail(`${where}.supplementary must be an object or null`);
    supplementary = {
      window: asString(sup.window, `${where}.supplementary.window`),
      label: asString(sup.label, `${where}.supplementary.label`),
      cumulative_gap_rm_million: asNumber(
        sup.cumulative_gap_rm_million,
        `${where}.supplementary.cumulative_gap_rm_million`
      ),
    };
    if (!supplementary.label.toLowerCase().includes("supplementary")) {
      fail(`${where}.supplementary.label must contain "supplementary"`);
    }
    if (supplementary.window === headline.window) {
      fail(`${where}: supplementary window equals the headline window`);
    }
  }
  return {
    anchor_year: asNumber(v.anchor_year, `${where}.anchor_year`),
    prices: "constant_2019_rm",
    receipts_series_id: asString(v.receipts_series_id, `${where}.receipts_series_id`),
    arrivals_series_id: asString(v.arrivals_series_id, `${where}.arrivals_series_id`),
    cpi_series_id: asString(v.cpi_series_id, `${where}.cpi_series_id`),
    deflator: (() => {
      const d = v.deflator;
      if (!isObject(d)) fail(`${where}.deflator must be an object`);
      return {
        series_id: asString(d.series_id, `${where}.deflator.series_id`),
        description: asString(d.description, `${where}.deflator.description`),
        anchor_year: asNumber(d.anchor_year, `${where}.deflator.anchor_year`),
        anchor_index: asNumber(d.anchor_index, `${where}.deflator.anchor_index`),
        index_base: asString(d.index_base, `${where}.deflator.index_base`),
        source: parseMacroSource(d.source, `${where}.deflator.source`),
      };
    })(),
    years,
    volume_trap: {
      excursionist_share_2019_pct: vtNum("excursionist_share_2019_pct"),
      excursionist_share_2024_pct: vtNum("excursionist_share_2024_pct"),
      excursionist_share_change_pp: vtNum("excursionist_share_change_pp"),
      land_mode_share_2024_pct: vtNum("land_mode_share_2024_pct"),
      land_mode_share_source: asString(vt.land_mode_share_source, `${where}.volume_trap.land_mode_share_source`),
    },
    headline,
    supplementary,
  };
}

function parseSegmentationFragment(v: unknown): SegmentationFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.source_segmentation";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (!Array.isArray(v.markets) || v.markets.length === 0) fail(`${where}.markets must be a non-empty array`);
  if (!Array.isArray(v.clusters) || v.clusters.length === 0) fail(`${where}.clusters must be a non-empty array`);
  if (!isObject(v.tier_labels)) fail(`${where}.tier_labels must be an object`);
  const markets: MarketSegment[] = v.markets.map((m, i) => {
    const w = `${where}.markets[${i}]`;
    if (!isObject(m)) fail(`${w} must be an object`);
    const tier: YieldTier | null = m.yield_tier === undefined || m.yield_tier === null
      ? null
      : oneOf(m.yield_tier, ["top_quartile", "upper_middle", "lower_middle", "bottom_quartile"] as const, `${w}.yield_tier`);
    const out: MarketSegment = {
      market: asString(m.market, `${w}.market`),
      clustered: m.clustered === true,
      yield_rm_per_visitor_2024: optNum(m.yield_rm_per_visitor_2024, `${w}.yield_rm_per_visitor_2024`),
      arrivals_persons_2024: optNum(m.arrivals_persons_2024, `${w}.arrivals_persons_2024`),
      arrivals_growth_pct: optNum(m.arrivals_growth_pct, `${w}.arrivals_growth_pct`),
      cluster_id: optNum(m.cluster_id, `${w}.cluster_id`),
      segment_name: m.segment_name === undefined || m.segment_name === null
        ? null
        : asString(m.segment_name, `${w}.segment_name`),
      yield_tier: tier ?? null,
      tier_label: m.tier_label === undefined || m.tier_label === null
        ? null
        : asString(m.tier_label, `${w}.tier_label`),
    };
    if (m.wef_indicators !== undefined) {
      if (!isObject(m.wef_indicators)) fail(`${w}.wef_indicators must be an object`);
      const ind: Record<string, number | null> = {};
      for (const [k, val] of Object.entries(m.wef_indicators)) {
        ind[k] = val === null ? null : optNum(val, `${w}.wef_indicators.${k}`);
      }
      out.wef_indicators = ind;
    }
    if (m.wef_missing !== undefined) {
      if (!Array.isArray(m.wef_missing)) fail(`${w}.wef_missing must be an array`);
      out.wef_missing = m.wef_missing.map((x, j) => asString(x, `${w}.wef_missing[${j}]`));
    }
    if (m.wef_ref_years !== undefined) {
      if (!isObject(m.wef_ref_years)) fail(`${w}.wef_ref_years must be an object`);
      const yrs: Record<string, number> = {};
      for (const [k, val] of Object.entries(m.wef_ref_years)) {
        if (typeof val !== "number" || !Number.isInteger(val)) {
          fail(`${w}.wef_ref_years.${k} must be an integer year`);
        }
        yrs[k] = val;
      }
      out.wef_ref_years = yrs;
    }
    if (m.excluded_reason !== undefined) {
      out.excluded_reason = m.excluded_reason === undefined || m.excluded_reason === null
        ? null
        : asString(m.excluded_reason, `${w}.excluded_reason`);
    }
    return out;
  });
  const clusters: ClusterProfile[] = v.clusters.map((c, i) => {
    const w = `${where}.clusters[${i}]`;
    if (!isObject(c)) fail(`${w} must be an object`);
    if (!Array.isArray(c.members) || c.members.length === 0) fail(`${w}.members must be a non-empty array`);
    return {
      cluster_id: asNumber(c.cluster_id, `${w}.cluster_id`),
      segment_name: asString(c.segment_name, `${w}.segment_name`),
      naming_rationale: asString(c.naming_rationale, `${w}.naming_rationale`),
      members: c.members.map((m2, j) => asString(m2, `${w}.members[${j}]`)),
      mean_yield_rm_per_visitor: asNumber(c.mean_yield_rm_per_visitor, `${w}.mean_yield_rm_per_visitor`),
    };
  });
  const tiers = v.tier_labels as Record<string, unknown>;
  const tierLabels: Record<YieldTier, string> = {
    top_quartile: asString(tiers.top_quartile, `${where}.tier_labels.top_quartile`),
    upper_middle: asString(tiers.upper_middle, `${where}.tier_labels.upper_middle`),
    lower_middle: asString(tiers.lower_middle, `${where}.tier_labels.lower_middle`),
    bottom_quartile: asString(tiers.bottom_quartile, `${where}.tier_labels.bottom_quartile`),
  };
  if (!isObject(v.yield_quartile_boundaries)) fail(`${where}.yield_quartile_boundaries must be an object`);
  const boundaries = v.yield_quartile_boundaries as Record<string, unknown>;
  // schema 1.1.0: input provenance + the documented feature contract
  const segSource = v.source;
  if (!isObject(segSource)) fail(`${where}.source must be an object`);
  if (!Array.isArray(v.features) || v.features.length === 0) {
    fail(`${where}.features must be a non-empty array`);
  }
  const features: FeatureDef[] = v.features.map((ft, i) => {
    const fw = `${where}.features[${i}]`;
    if (!isObject(ft)) fail(`${fw} must be an object`);
    return {
      name: asString(ft.name, `${fw}.name`),
      description: asString(ft.description, `${fw}.description`),
      unit: asString(ft.unit, `${fw}.unit`),
      source: asString(ft.source, `${fw}.source`),
      transform: asString(ft.transform, `${fw}.transform`),
      imputation: asString(ft.imputation, `${fw}.imputation`),
    };
  });
  return {
    anchor_year: asNumber(v.anchor_year, `${where}.anchor_year`),
    method: asString(v.method, `${where}.method`),
    seed: asNumber(v.seed, `${where}.seed`),
    n_clusters: asNumber(v.n_clusters, `${where}.n_clusters`),
    naming_rationale: asString(v.naming_rationale, `${where}.naming_rationale`),
    source: {
      market_source_file: asString(segSource.market_source_file, `${where}.source.market_source_file`),
      wef_file: asString(segSource.wef_file, `${where}.source.wef_file`),
      wef_dataset: asString(segSource.wef_dataset, `${where}.source.wef_dataset`),
      wef_url: asString(segSource.wef_url, `${where}.source.wef_url`),
      wef_ref_year: asNumber(segSource.wef_ref_year, `${where}.source.wef_ref_year`),
    },
    features,
    markets,
    clusters,
    tier_labels: tierLabels,
    yield_quartile_boundaries: {
      q25: asNumber(boundaries.q25, `${where}.yield_quartile_boundaries.q25`),
      q50: asNumber(boundaries.q50, `${where}.yield_quartile_boundaries.q50`),
      q75: asNumber(boundaries.q75, `${where}.yield_quartile_boundaries.q75`),
    },
  };
}

function parseRegionalBenchmarkFragment(v: unknown): RegionalBenchmarkFragment | undefined {
  if (v === undefined) return undefined;
  const where = "fragments.regional_benchmark";
  if (!isObject(v)) fail(`${where} must be an object`);
  if (v.currency !== "usd") fail(`${where}.currency must be "usd"`);
  if (!Array.isArray(v.countries) || v.countries.length < 2) {
    fail(`${where}.countries must have at least 2 rows (Malaysia + comparators)`);
  }
  const countries: RegionalCountry[] = v.countries.map((c, i) => {
    const w = `${where}.countries[${i}] (${String(c && typeof c === "object" ? (c as { country?: unknown }).country : c)})`;
    if (!isObject(c)) fail(`${w} must be an object`);
    const basis = oneOf(
      c.receipts_basis,
      ["survey", "balance_of_payments", "administrative_aggregate"] as const,
      `${w}.receipts_basis`,
    );
    const role = oneOf(c.role, ["baseline", "comparator"] as const, `${w}.role`);
    if (!Array.isArray(c.source_urls) || c.source_urls.length === 0) fail(`${w}.source_urls must be a non-empty array`);
    const r = c.receipts_2024;
    if (!isObject(r)) fail(`${w}.receipts_2024 must be an object`);
    if (typeof r.usd_billion !== "number") fail(`${w}.receipts_2024.usd_billion must be a number`);
    if (typeof c.arrivals_2024 !== "number") fail(`${w}.arrivals_2024 must be a number`);
    // reconciliation: yield vs receipts/arrivals (the pipeline's validator, mirrored)
    const implied = (r.usd_billion * 1e9) / c.arrivals_2024;
    if (typeof c.yield_2024_usd_per_visitor !== "number" || Math.abs(c.yield_2024_usd_per_visitor - implied) > implied * 0.01) {
      fail(`${w}: yield_2024_usd_per_visitor does not reconcile with receipts/arrivals`);
    }
    return {
      country: asString(c.country, `${w}.country`),
      role,
      receipts_basis: basis,
      receipts_basis_note: asString(c.receipts_basis_note, `${w}.receipts_basis_note`),
      arrivals_2024: c.arrivals_2024,
      receipts_2024: {
        local_amount_billion: optNum(r.local_amount_billion, `${w}.receipts_2024.local_amount_billion`),
        local_currency: r.local_currency === undefined || r.local_currency === null
          ? null
          : asString(r.local_currency, `${w}.receipts_2024.local_currency`),
        usd_billion: r.usd_billion,
        usd_note: asString(r.usd_note, `${w}.receipts_2024.usd_note`),
      },
      yield_2024_usd_per_visitor: c.yield_2024_usd_per_visitor as number,
      yield_2019_usd_per_visitor: asNumber(c.yield_2019_usd_per_visitor, `${w}.yield_2019_usd_per_visitor`),
      yield_change_2024_vs_2019_pct: asNumber(c.yield_change_2024_vs_2019_pct, `${w}.yield_change_2024_vs_2019_pct`),
      yield_multiple_of_malaysia_2024: optNum(
        c.yield_multiple_of_malaysia_2024,
        `${w}.yield_multiple_of_malaysia_2024`
      ),
      source_urls: c.source_urls.map((u, j) => asString(u, `${w}.source_urls[${j}]`)),
    };
  });
  if (!Array.isArray(v.excluded_markets) || v.excluded_markets.length === 0) {
    fail(`${where}.excluded_markets must be stated explicitly (never a silent omission)`);
  }
  if (!Array.isArray(v.caveats) || v.caveats.length === 0) fail(`${where}.caveats must be a non-empty array`);
  return {
    anchor_year: asNumber(v.anchor_year, `${where}.anchor_year`),
    baseline_year: asNumber(v.baseline_year, `${where}.baseline_year`),
    currency: "usd",
    baseline_market: asString(v.baseline_market, `${where}.baseline_market`),
    countries,
    excluded_markets: v.excluded_markets.map((e, i) => {
      const w = `${where}.excluded_markets[${i}]`;
      if (!isObject(e)) fail(`${w} must be an object`);
      return { country: asString(e.country, `${w}.country`), reason: asString(e.reason, `${w}.reason`) };
    }),
    caveats: v.caveats.map((c, i) => asString(c, `${where}.caveats[${i}]`)),
    research_doc: asString(v.research_doc, `${where}.research_doc`),
  };
}

/** Find series by measure and counting basis. Basis-labelled, never merged. */
export function seriesFor(bundle: Bundle, measure: string, basis: Basis): Series[] {
  return bundle.fragments.national_series.series.filter(
    (s) => s.measure === measure && s.basis === basis
  );
}


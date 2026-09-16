import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleFromString, type Bundle } from "../src/lib/bundle";
import {
  buildDecomposition,
  buildRegionalComparison,
  buildMarketMapData,
  buildMethodIndex,
  cumulativeMissingBillions,
  yearLabel,
} from "../src/lib/diagnosis";

const raw = readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8");
const bundle: Bundle = loadBundleFromString(raw);

// ---------------------------------------------------------------------------
// Decomposition (ticket T6): volume vs value, real vs nominal, from the bundle
// ---------------------------------------------------------------------------

describe("buildDecomposition", () => {
  const mb = bundle.fragments.missing_billions;
  const spec = buildDecomposition(mb!);

  it("indexes every trace to 2019 = 100", () => {
    for (const t of spec.indexed) {
      const base = t.points.find((p) => p[0] === spec.anchorYear)![1]!;
      expect(base).toBeCloseTo(100, 9);
    }
  });

  it("carries the pre-registered headline: RM10,098.4m, 2020-2024, constant 2019 prices", () => {
    // The pre-registered headline (bundle-guarded): window fixed at 2020-2024
    // BEFORE the TSA 2025 release; value recomputed from the revised receipts.
    expect(spec.headline.window).toEqual({ from: 2020, to: 2024 });
    expect(spec.headline.prices).toBe("constant_2019_rm");
    expect(mb!.headline.cumulative_gap_rm_million).toBeCloseTo(10098.357652778674, 6);
    expect(spec.headline.cumulativeGapRmMillion).toBe(mb!.headline.cumulative_gap_rm_million);
    // the guarded value IS the sum of the fragment's own 2020-2024 rows
    const years = mb!.years.filter((y) => y.year >= 2020 && y.year <= 2024);
    const sum = years.reduce((s, y) => s + y.gap_2019_prices_rm_million, 0);
    expect(sum).toBeCloseTo(spec.headline.cumulativeGapRmMillion, 6);
    expect(spec.headline.cumulativeGapRmMillion).toBeGreaterThan(9_500);
    expect(spec.headline.cumulativeGapRmMillion).toBeLessThan(11_000);
  });

  it("schema 1.1.0: the supplementary 2020-2025 cumulative is labelled and never the headline", () => {
    expect(spec.supplementary).not.toBeNull();
    expect(spec.supplementary!.window).toEqual({ from: 2020, to: 2025 });
    expect(spec.supplementary!.label.toLowerCase()).toContain("supplementary");
    expect(spec.supplementary!.label.toLowerCase()).toContain("never");
    // RM6,832.7m — supplementary only; distinct from the RM10,098.4m headline
    expect(spec.supplementary!.cumulativeGapRmMillion).toBeCloseTo(6832.69199714115, 6);
    expect(spec.supplementary!.cumulativeGapRmMillion).not.toBeCloseTo(
      spec.headline.cumulativeGapRmMillion, 3
    );
    // the basis notes state the supplementary rule
    expect(spec.basisNotes.some((n) => /Supplementary only \(never the headline\)/.test(n))).toBe(true);
  });

  it("schema 1.1.0: the 2025 row is preliminary and labelled 2025p, never final", () => {
    const row2025 = mb!.years.find((y) => y.year === 2025)!;
    expect(row2025.revision_status).toBe("preliminary");
    expect(yearLabel(row2025)).toBe("2025p");
    expect(yearLabel(mb!.years.find((y) => y.year === 2024)!)).toBe("2024");
  });

  it("keeps the real-vs-nominal distinction: nominal rose, real stagnated", () => {
    const nominal = spec.perVisitor.find((t) => /nominal/.test(t.name))!;
    const real = spec.perVisitor.find((t) => /real 2019/.test(t.name))!;
    const nom2024 = nominal.points.find((p) => p[0] === 2024)![1]!;
    const nom2019 = nominal.points.find((p) => p[0] === 2019)![1]!;
    const real2024 = real.points.find((p) => p[0] === 2024)![1]!;
    const real2019 = real.points.find((p) => p[0] === 2019)![1]!;
    expect(nom2024).toBeGreaterThan(nom2019); // nominal flatters the recovery
    // the stagnation line (F1, revised receipts): RM2,480.56 vs RM2,474.10 —
    // each 2024 visitor was worth what a 2019 visitor was worth (+0.26%)
    expect(real2024).toBeCloseTo(2480.562309394958, 6);
    expect(real2019).toBeCloseTo(2474.1034009237956, 6);
    expect((real2024 - real2019) / real2019).toBeLessThan(0.003); // pinned to the anchor
    // and the stagnation numbers travel in the spec (headline window end = 2024)
    expect(spec.stagnation.latestYear).toBe(2024);
    expect(spec.stagnation.latestPerVisitorRealRm).toBeCloseTo(real2024, 9);
  });

  it("labels the bases of every trace source (never silently mixed)", () => {
    expect(spec.basisNotes.some((n) => /visitor-basis/.test(n))).toBe(true);
    expect(spec.basisNotes.some((n) => /tourist basis/.test(n))).toBe(true);
    expect(spec.basisNotes.some((n) => /CPI/.test(n))).toBe(true);
  });

  it("marks the naive nominal gap as invalid", () => {
    expect(spec.basisNotes.some((n) => /INVALID/.test(n))).toBe(true);
  });

  it("cumulativeMissingBillions is the plain filtered sum", () => {
    const manual = mb!.years
      .filter((y) => y.year === 2022)
      .reduce((s, y) => s + y.gap_2019_prices_rm_million, 0);
    expect(cumulativeMissingBillions(mb!, 2022, 2022)).toBe(manual);
  });
});

// ---------------------------------------------------------------------------
// Regional benchmark (ticket T6): supporting context, with caveats
// ---------------------------------------------------------------------------

describe("buildRegionalComparison", () => {
  const frag = bundle.fragments.regional_benchmark!;
  const comp = buildRegionalComparison(frag);

  it("has Malaysia as baseline plus the two comparators", () => {
    expect(comp.baselineMarket).toBe("Malaysia");
    expect(comp.rows.map((r) => r.country)).toEqual(["Malaysia", "Thailand", "Indonesia"]);
    expect(comp.rows.find((r) => r.isBaseline)!.country).toBe("Malaysia");
  });

  it("carries the researched headline numbers from the bundle", () => {
    const by = Object.fromEntries(comp.rows.map((r) => [r.country, r]));
    expect(by["Malaysia"].yield2024Usd).toBe(600);
    expect(by["Malaysia"].changePct).toBe(-29);
    expect(by["Thailand"].yield2024Usd).toBe(1363);
    expect(by["Thailand"].changePct).toBe(-16);
    expect(by["Thailand"].multipleOfMalaysia).toBe(2.3);
    expect(by["Indonesia"].yield2024Usd).toBe(1202);
    expect(by["Indonesia"].changePct).toBe(5);
    expect(by["Indonesia"].multipleOfMalaysia).toBe(2.0);
  });

  it("states the survey vs balance-of-payments bases per country", () => {
    const by = Object.fromEntries(comp.rows.map((r) => [r.country, r]));
    expect(by["Malaysia"].receiptsBasisLabel).toMatch(/survey/);
    expect(by["Thailand"].receiptsBasisLabel).toMatch(/survey/);
    expect(by["Indonesia"].receiptsBasisLabel).toMatch(/balance of payments/);
  });

  it("keeps Vietnam excluded, with the documented reason", () => {
    expect(comp.excluded.map((e) => e.country)).toEqual(["Vietnam"]);
    expect(comp.excluded[0].reason).toMatch(/domestic/);
  });

  it("always ships the methodology caveats", () => {
    expect(comp.caveats.length).toBeGreaterThanOrEqual(3);
    expect(comp.caveats.some((c) => /supporting context/i.test(c))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Source-market map (ticket T6): yields joined with segments, gracefully
// ---------------------------------------------------------------------------

describe("buildMarketMapData", () => {
  const sm = bundle.fragments.source_market!;
  const seg = bundle.fragments.source_segmentation;

  it("joins every market with its segment and tier", () => {
    const data = buildMarketMapData(sm, seg);
    expect(data.segmentationAvailable).toBe(true);
    const singapore = data.markets.find((m) => m.market === "Singapore")!;
    expect(singapore.segmentName).toBe("Volume Traps");
    expect(singapore.tier).toBe("bottom_quartile");
    expect(singapore.yieldRmPerVisitor).not.toBeNull();
    const named = new Set(seg!.clusters.map((c) => c.segment_name));
    for (const m of data.markets) {
      if (m.segmentName) expect(named.has(m.segmentName)).toBe(true);
      else expect(m.clustered).toBe(false);
    }
  });

  it("maps bundle market names onto the committed world geometry", () => {
    const geo = JSON.parse(readFileSync(join(__dirname, "..", "public", "geo", "world.json"), "utf8"));
    const names = new Set<string>(geo.features.map((f: { properties: { name: string } }) => f.properties.name));
    const data = buildMarketMapData(sm, seg);
    const missing = data.markets.filter((m) => !names.has(m.geoName));
    expect(missing).toEqual([]); // every market must shade on the committed geometry
  });

  it("degrades gracefully when the bundle misses the segmentation fragment", () => {
    const withoutSeg: Bundle = {
      ...bundle,
      fragments: { ...bundle.fragments, source_segmentation: undefined },
    };
    const data = buildMarketMapData(sm, undefined);
    expect(data.segmentationAvailable).toBe(false);
    expect(data.markets.every((m) => m.segmentName === null && m.tier === null)).toBe(true);
    // yields still travel — the map still shades by yield
    expect(data.markets.filter((m) => m.yieldRmPerVisitor !== null).length).toBeGreaterThan(0);
    expect(withoutSeg.fragments.source_segmentation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Method index (ticket T6): every number traceable, bundle version stated
// ---------------------------------------------------------------------------

describe("buildMethodIndex", () => {
  const index = buildMethodIndex(bundle);

  it("states the bundle version, checksum and generation time", () => {
    expect(index.bundleVersion).toBe(bundle.bundle_version);
    expect(index.checksum).toBe(bundle.checksum);
    expect(index.generatedUtc).toBe(bundle.generated_utc);
  });

  it("documents every fragment the bundle carries", () => {
    const documented = new Set(index.entries.map((e) => e.fragment));
    for (const key of Object.keys(bundle.fragments)) {
      if (key === "simulator") continue; // ticket T7 documents itself
      expect(documented.has(key)).toBe(true);
    }
  });

  it("cites official URLs (http) somewhere in every entry that has external sources", () => {
    const byFragment = Object.fromEntries(index.entries.map((e) => [e.fragment, e]));
    expect(byFragment["macro_series"].sources.some((s) => s.url && s.url.startsWith("http"))).toBe(true);
    expect(byFragment["source_segmentation"].sources.some((s) => s.url && s.url.startsWith("http"))).toBe(true);
    expect(byFragment["regional_benchmark"].sources.every((s) => s.url && s.url.startsWith("http"))).toBe(true);
  });

  it("names the workbook sources down to sheet and row for the national series", () => {
    const national = index.entries.find((e) => e.fragment === "national_series")!;
    expect(national.sources.length).toBe(bundle.fragments.national_series.series.length);
    for (const s of national.sources) {
      expect(s.label).toMatch(/sheet "/);
      expect(s.label).toMatch(/row \d+/);
    }
  });
});

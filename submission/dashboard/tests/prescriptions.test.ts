import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleFromString, type Bundle } from "../src/lib/bundle";
import { buildPrescriptions, PRESCRIPTION_LABELS } from "../src/lib/prescriptions";

const raw = readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8");
const bundle: Bundle = loadBundleFromString(raw);

describe("buildPrescriptions (ticket T10)", () => {
  const seg = bundle.fragments.source_segmentation!;
  const data = buildPrescriptions(seg);

  it("derives exactly one prescription per clustered market, from the bundle alone", () => {
    const clustered = seg.markets.filter((m) => m.clustered);
    expect(data.rows).toHaveLength(clustered.length);
    for (const row of data.rows) {
      expect(["grow", "coast", "reduce_reliance"]).toContain(row.prescription);
    }
  });

  it("prescribes reduce reliance for the Volume Traps segment (Singapore, Brunei)", () => {
    const by = Object.fromEntries(data.rows.map((r) => [r.market, r]));
    for (const market of ["Singapore", "Brunei"]) {
      expect(by[market].prescription).toBe("reduce_reliance");
      expect(by[market].segmentName).toBe("Volume Traps");
    }
  });

  it("prescribes grow for the high-yield and high-growth segments", () => {
    const by = Object.fromEntries(data.rows.map((r) => [r.market, r]));
    for (const market of ["Australia", "United Kingdom", "China", "India"]) {
      expect(by[market].prescription).toBe("grow");
    }
    expect(by["China"].segmentName).toBe("High-Growth Emerging");
    expect(by["Australia"].segmentName).toBe("High-Yield Long-Haul");
  });

  it("prescribes coast for the Low-Yield Steady segment", () => {
    const by = Object.fromEntries(data.rows.map((r) => [r.market, r]));
    for (const market of ["Thailand", "Vietnam", "Pakistan", "Philippines"]) {
      expect(by[market].prescription).toBe("coast");
    }
  });

  it("carries the numbers behind each verdict: yield, arrivals, growth, segment, tier", () => {
    const by = Object.fromEntries(data.rows.map((r) => [r.market, r]));
    const singapore = by["Singapore"];
    const fragRow = seg.markets.find((m) => m.market === "Singapore")!;
    expect(singapore.yieldRmPerVisitor).toBe(fragRow.yield_rm_per_visitor_2024);
    expect(singapore.arrivals2024).toBe(fragRow.arrivals_persons_2024);
    expect(singapore.arrivalsGrowthPct).toBeCloseTo(fragRow.arrivals_growth_pct!, 9);
    expect(singapore.tier).toBe("bottom_quartile");
    expect(singapore.tierLabel).toBe(seg.tier_labels.bottom_quartile);
    // every verdict carries its evidence, never a bare label
    for (const row of data.rows) {
      expect(row.yieldRmPerVisitor).not.toBeNull();
      expect(row.arrivals2024).not.toBeNull();
      expect(row.rationale.length).toBeGreaterThan(0);
    }
  });

  it("keeps the Volume Traps wording neutral: a measurement critique, not market vilification", () => {
    expect(PRESCRIPTION_LABELS.reduce_reliance).toMatch(/reduce reliance on low-yield/i);
    expect(PRESCRIPTION_LABELS.reduce_reliance.toLowerCase()).not.toMatch(/trap market|bad|blame|villain/);
    for (const row of data.rows.filter((r) => r.prescription === "reduce_reliance")) {
      expect(row.rationale).toMatch(/measurement|arrivals KPI/i);
    }
  });

  it("leaves unclustered markets without a prescription and says why", () => {
    const unclustered = seg.markets.filter((m) => !m.clustered).map((m) => m.market);
    expect(data.unclustered.map((u) => u.market).sort()).toEqual([...unclustered].sort());
    for (const u of data.unclustered) {
      expect(data.rows.find((r) => r.market === u.market)).toBeUndefined();
    }
  });

  it("flags any segment name no rule covers, instead of guessing", () => {
    const renamed: Bundle = {
      ...bundle,
      fragments: {
        ...bundle.fragments,
        source_segmentation: {
          ...seg,
          markets: seg.markets.map((m) =>
            m.clustered && m.market === "Singapore"
              ? { ...m, segment_name: "Mystery Segment" }
              : m
          ),
        },
      },
    };
    const d = buildPrescriptions(renamed.fragments.source_segmentation);
    expect(d.unrulySegments).toContain("Mystery Segment");
    expect(d.rows.find((r) => r.market === "Singapore")).toBeUndefined();
  });

  it("degrades gracefully when the segmentation fragment is absent", () => {
    const d = buildPrescriptions(undefined);
    expect(d.available).toBe(false);
    expect(d.rows).toEqual([]);
    expect(d.unclustered).toEqual([]);
  });
});

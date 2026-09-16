/**
 * Ticket #19 — simulator view-model tests (offline, no network).
 *
 * The view model is the UI-facing pure logic on top of the pinned simulator
 * arithmetic: slider weights (percent points) init/clamp/renormalise, the mix
 * label, and the per-market rows that join prescriptions. Every number it
 * produces must come from the bundle fragment via src/lib/simulator.ts —
 * nothing hardcoded.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleFromString } from "../src/lib/bundle";
import { buildPrescriptions } from "../src/lib/prescriptions";
import { normalizeShares, simulateFragmentMix, shares2023, shares2024 } from "../src/lib/simulator";
import {
  buildSimulatorView,
  clampWeights,
  mixLabelFor,
  weightsFromShares,
} from "../src/lib/simulator-view";

const bundle = loadBundleFromString(
  readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8")
);
const frag = bundle.fragments.simulator!;
const prescriptions = buildPrescriptions(bundle.fragments.source_segmentation);

describe("weightsFromShares", () => {
  it("turns the 2024 observed shares into percent-point weights", () => {
    const w = weightsFromShares(shares2024(frag));
    expect(w).toHaveLength(frag.markets.length);
    const singapore = frag.markets.findIndex((m) => m.market === "Singapore");
    expect(w[singapore]).toBeCloseTo(frag.markets[singapore].share_of_arrivals_2024 * 100, 9);
  });

  it("renormalises back to shares summing to 1", () => {
    const w = weightsFromShares(shares2023(frag));
    expect(normalizeShares(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe("clampWeights", () => {
  it("clamps negative weights to zero and keeps the length", () => {
    expect(clampWeights([10, -5, 0])).toEqual([10, 0, 0]);
  });

  it("treats non-finite weights as zero (never NaN into the arithmetic)", () => {
    expect(clampWeights([Number.NaN, Number.POSITIVE_INFINITY, 5])).toEqual([0, 0, 5]);
  });
});

describe("mixLabelFor", () => {
  it("recognises the 2024 observed mix", () => {
    expect(mixLabelFor(frag, weightsFromShares(shares2024(frag)))).toBe("2024 observed mix");
  });

  it("recognises the 2023 observed mix (earliest observed mix)", () => {
    expect(mixLabelFor(frag, weightsFromShares(shares2023(frag)))).toBe("2023 observed mix");
  });

  it("labels anything else a custom mix", () => {
    const w = weightsFromShares(shares2024(frag));
    expect(mixLabelFor(frag, [1, ...w.slice(1)])).toBe("Custom mix");
  });
});

describe("buildSimulatorView", () => {
  const weights = weightsFromShares(shares2024(frag));
  const view = buildSimulatorView(frag, weights, prescriptions);

  it("recomputes the 2024-actual-mix outcome from the bundle (reconciles with the headline)", () => {
    const result = simulateFragmentMix(frag, shares2024(frag));
    expect(view.result.yield_per_visitor_real_rm).toBeCloseTo(result.yield_per_visitor_real_rm, 9);
    expect(view.result.gap_2019_prices_rm_million).toBeCloseTo(
      result.gap_2019_prices_rm_million,
      9
    );
  });

  it("produces one row per market with normalised shares and matching contributions", () => {
    expect(view.rows).toHaveLength(frag.markets.length);
    expect(view.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    for (let i = 0; i < view.rows.length; i++) {
      expect(view.rows[i].sharePct).toBeCloseTo(view.shares[i] * 100, 9);
      expect(view.rows[i].contributionRmMillion).toBeCloseTo(
        view.result.contributions_2019_prices_rm_million[i],
        9
      );
      expect(view.rows[i].yieldReal2019).toBe(frag.markets[i].yield_2024_real_2019_rm_per_visitor);
    }
  });

  it("joins per-market prescriptions from the segmentation fragment", () => {
    const by = Object.fromEntries(view.rows.map((r) => [r.market, r]));
    expect(by["Singapore"].prescription).toBe("reduce_reliance");
    expect(by["Singapore"].segmentName).toBe("Volume Traps");
    expect(by["Australia"].prescription).toBe("grow");
    // markets absent from the segmentation carry no invented verdict
    for (const row of view.rows) {
      if (row.prescription === null) expect(row.segmentName).toBeNull();
    }
    expect(view.rows.some((r) => r.prescription === null)).toBe(true);
  });

  it("handles the all-zeros mix: uniform shares, no NaN, no throw", () => {
    const zeros = frag.markets.map(() => 0);
    const uniform = buildSimulatorView(frag, zeros, prescriptions);
    expect(uniform.shares).toEqual(frag.markets.map(() => 1 / frag.markets.length));
    expect(Number.isFinite(uniform.result.receipts_2019_prices_rm_million)).toBe(true);
    expect(Number.isFinite(uniform.result.gap_2019_prices_rm_million)).toBe(true);
  });

  it("a higher-weight shift to high-yield markets raises yield and shrinks the gap", () => {
    const shifted = [...weights];
    const china = frag.markets.findIndex((m) => m.market === "China");
    const singapore = frag.markets.findIndex((m) => m.market === "Singapore");
    shifted[singapore] -= 10;
    shifted[china] += 10;
    const after = buildSimulatorView(frag, shifted, prescriptions);
    expect(after.result.yield_per_visitor_real_rm).toBeGreaterThan(view.result.yield_per_visitor_real_rm);
    expect(after.result.gap_2019_prices_rm_million).toBeLessThan(view.result.gap_2019_prices_rm_million);
  });
});

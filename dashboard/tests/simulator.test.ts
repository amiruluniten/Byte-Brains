/**
 * Ticket T7 — simulator arithmetic tests (offline, no network).
 *
 * 1. Round-trip: the fixture tests/fixtures/simulator-fixture.json was written
 *    by the PIPELINE (simulator.simulate_mix, Python). Every case must be
 *    reproduced from `inputs` alone by the TypeScript arithmetic.
 * 2. Reconciliation: at the 2024 actual mix, the simulator MUST reconcile with
 *    the bundle's missing_billions fragment exactly (float tolerance).
 * 3. Presets + normalisation invariants.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBundleFromString } from "../src/lib/bundle";
import {
  normalizeShares,
  policySingaporeShift,
  shares2023,
  shares2024,
  simulateFragmentMix,
  simulateMix,
} from "../src/lib/simulator";

const bundle = loadBundleFromString(
  readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8")
);

interface FixtureCase {
  name: string;
  shares: number[];
  expected: {
    yield_per_visitor_real_rm: number;
    receipts_2019_prices_rm_million: number;
    counterfactual_2019_prices_rm_million: number;
    gap_2019_prices_rm_million: number;
    contributions_2019_prices_rm_million: number[];
  };
}
interface SimulatorFixture {
  inputs: {
    markets: string[];
    yields_real: number[];
    shares_2024: number[];
    shares_2023: number[];
    visitor_arrivals: number;
    anchor_per_visitor_real: number;
    cpi_ratio_to_anchor: number;
    prices: string;
  };
  cases: FixtureCase[];
}

const roundTrip = JSON.parse(
  readFileSync(
    join(__dirname, "fixtures", "simulator-fixture.json"),
    "utf8"
  )
) as SimulatorFixture;

/** Python and TS add the same doubles in the same order; the tolerance only
 * absorbs float non-associativity across the JSON round-trip. */
const EPS = 1e-9;

describe("round-trip vs the Python-written fixture", () => {
  const inputs = roundTrip.inputs;

  it("fixture inputs match the committed bundle's simulator fragment", () => {
    const frag = bundle.simulator!;
    expect(inputs.markets).toEqual(frag.markets.map((m) => m.market));
    expect(inputs.yields_real).toEqual(
      frag.markets.map((m) => m.yield_2024_real_2019_rm_per_visitor)
    );
    expect(inputs.visitor_arrivals).toBe(frag.visitor_arrivals_2024);
    expect(inputs.anchor_per_visitor_real).toBe(frag.anchor_per_visitor_real_2019_rm);
    expect(inputs.prices).toBe("constant_2019_rm");
  });

  it("reproduces every expected case from inputs alone", () => {
    for (const c of roundTrip.cases) {
      const got = simulateMix(
        inputs.yields_real,
        c.shares,
        inputs.visitor_arrivals,
        inputs.anchor_per_visitor_real
      );
      expect(got.yield_per_visitor_real_rm).toBeCloseTo(
        c.expected.yield_per_visitor_real_rm,
        9
      );
      expect(got.receipts_2019_prices_rm_million).toBeCloseTo(
        c.expected.receipts_2019_prices_rm_million,
        6
      );
      expect(got.counterfactual_2019_prices_rm_million).toBeCloseTo(
        c.expected.counterfactual_2019_prices_rm_million,
        6
      );
      expect(got.gap_2019_prices_rm_million).toBeCloseTo(
        c.expected.gap_2019_prices_rm_million,
        6
      );
      got.contributions_2019_prices_rm_million.forEach((v, i) => {
        expect(v).toBeCloseTo(c.expected.contributions_2019_prices_rm_million[i], 6);
      });
    }
  });

  it("the 2024-actual-mix case reconciles with the missing_billions fragment", () => {
    const case2024 = roundTrip.cases.find((c) => c.name === "2024 actual mix")!;
    const mb = (
      JSON.parse(readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8")) as {
        fragments: {
          missing_billions: { years: { year: number; gap_2019_prices_rm_million: number }[] };
        };
      }
    ).fragments.missing_billions;
    const row2024 = mb.years.find((y) => y.year === 2024)!;
    expect(case2024.expected.gap_2019_prices_rm_million).toBeCloseTo(
      row2024.gap_2019_prices_rm_million,
      6
    );
  });
});

describe("reconciliation with the headline calculator (committed bundle)", () => {
  const frag = bundle.simulator!;
  const result = simulateFragmentMix(frag, shares2024(frag));

  it("exists in the bundle and is constant-2019-prices only", () => {
    expect(frag).toBeDefined();
    expect(frag.prices).toBe("constant_2019_rm");
    expect(frag.anchor_year).toBe(2019);
    expect(frag.mix_year).toBe(2024);
  });

  it("2024 actual mix: receipts equal the headline actual (2019 prices)", () => {
    const mb = (
      JSON.parse(readFileSync(join(__dirname, "..", "data", "bundle.json"), "utf8")) as {
        fragments: {
          missing_billions: {
            years: {
              year: number;
              actual_receipts_2019_prices_rm_million: number;
              counterfactual_receipts_2019_prices_rm_million: number;
              gap_2019_prices_rm_million: number;
              per_visitor_real_2019_rm: number;
            }[];
          };
        };
      }
    ).fragments.missing_billions;
    const row = mb.years.find((y) => y.year === frag.mix_year)!;
    expect(result.receipts_2019_prices_rm_million).toBeCloseTo(
      row.actual_receipts_2019_prices_rm_million,
      6
    );
    expect(result.counterfactual_2019_prices_rm_million).toBeCloseTo(
      row.counterfactual_receipts_2019_prices_rm_million,
      6
    );
    expect(result.gap_2019_prices_rm_million).toBeCloseTo(row.gap_2019_prices_rm_million, 6);
    expect(result.yield_per_visitor_real_rm).toBeCloseTo(row.per_visitor_real_2019_rm, 6);
  });
});

describe("presets", () => {
  const frag = bundle.simulator!;

  it("2024 preset reproduces the actual shares", () => {
    const s = shares2024(frag);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    const singapore = frag.markets.findIndex((m) => m.market === "Singapore");
    expect(s[singapore]).toBeCloseTo(frag.markets[singapore].share_of_arrivals_2024, 12);
  });

  it("2023 preset uses the 2023 shares and sums to 1", () => {
    const s = shares2023(frag);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(s).not.toEqual(shares2024(frag));
  });

  it("policy preset moves Singapore toward high-yield markets and raises the mix yield", () => {
    const before = simulateFragmentMix(frag, shares2024(frag));
    const policy = policySingaporeShift(frag);
    const after = simulateFragmentMix(frag, policy);
    expect(policy.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);

    const sg = frag.markets.findIndex((m) => m.market === "Singapore");
    expect(policy[sg]).toBeCloseTo(shares2024(frag)[sg] * 0.5, 12);
    // recipients: top-3 real yields among coverage "both" excluding Singapore
    const top3 = frag.markets
      .map((m, i) => ({ i, y: m.yield_2024_real_2019_rm_per_visitor, cov: m.coverage }))
      .filter(({ i, cov }) => cov === "both" && i !== sg)
      .sort((a, b) => b.y - a.y)
      .slice(0, 3)
      .map((r) => r.i);
    for (const i of top3) {
      expect(policy[i]).toBeGreaterThan(shares2024(frag)[i]);
    }
    expect(after.yield_per_visitor_real_rm).toBeGreaterThan(
      before.yield_per_visitor_real_rm
    );
  });
});

describe("mix normalisation", () => {
  it("normalises any positive weights to shares summing to 1", () => {
    const s = normalizeShares([10, 30, 60]);
    expect(s[0]).toBeCloseTo(0.1, 12);
    expect(s[2]).toBeCloseTo(0.6, 12);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("never produces NaN when every slider is zero", () => {
    const s = normalizeShares([0, 0, 0]);
    expect(s).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("rejects negative shares and mismatched lengths", () => {
    expect(() => simulateMix([100], [-0.5], 1000, 100)).toThrow(/non-negative/);
    expect(() => simulateMix([100, 200], [1], 1000, 100)).toThrow(/same length/);
  });
});

describe("hand-computed arithmetic check", () => {
  it("matches the pipeline's own unit case", () => {
    const r = simulateMix([100.0, 200.0], [0.25, 0.75], 1_000_000, 150.0);
    expect(r.yield_per_visitor_real_rm).toBeCloseTo(175.0, 9);
    expect(r.receipts_2019_prices_rm_million).toBeCloseTo(175.0, 9);
    expect(r.counterfactual_2019_prices_rm_million).toBeCloseTo(150.0, 9);
    expect(r.gap_2019_prices_rm_million).toBeCloseTo(-25.0, 9);
    expect(r.contributions_2019_prices_rm_million[0]).toBeCloseTo(25.0, 9);
    expect(r.contributions_2019_prices_rm_million[1]).toBeCloseTo(150.0, 9);
  });
});

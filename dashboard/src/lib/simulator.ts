/**
 * Market-mix simulator arithmetic (ticket T7) — the client side of ADR-0002.
 *
 * The pipeline exports per-source-market yield coefficients (constant 2019
 * prices) in the bundle's `simulator` fragment; this module recomputes total
 * receipts, yield per visitor and the Missing Billions gap for ANY user-chosen
 * mix, live in the browser. No network, no ML.
 *
 * ARITHMETIC CONTRACT — mirrored 1:1 from
 * pipeline/src/bytebrains_pipeline/simulator.py::simulate_mix. Same operations
 * in the same order (plain left-to-right float sums, no rounding, no library
 * math). The round-trip fixture (tests/fixtures/simulator-fixture.json) was
 * written by the Python side; the tests must reproduce it from inputs alone.
 *
 * ALL FIGURES ARE CONSTANT-2019-PRICES (deflated by the DOSM national CPI).
 * Sign convention: gap = counterfactual (2019 mix held at 2019 real yield)
 * minus actual; POSITIVE = missing billions.
 */

export interface SimulatorMarket {
  market: string;
  coverage: "both" | "residual";
  yield_2024_nominal_rm_per_visitor: number | null;
  yield_2024_real_2019_rm_per_visitor: number;
  arrivals_2024_persons: number;
  arrivals_2023_persons: number;
  share_of_arrivals_2024: number;
  share_of_arrivals_2023: number;
}

export interface SimulatorFragment {
  prices: "constant_2019_rm";
  anchor_year: number; // 2019 — price anchor AND counterfactual yield anchor
  mix_year: number; // 2024
  comparison_year: number; // 2023 — earliest observed mix
  cpi_series_id: string;
  cpi_ratio_to_anchor_mix_year: number;
  visitor_arrivals_2024: number;
  visitor_arrivals_2023: number;
  anchor_per_visitor_real_2019_rm: number;
  markets: SimulatorMarket[];
}

export interface SimResult {
  /** Mix-weighted per-visitor receipts, 2019 RM. */
  yield_per_visitor_real_rm: number;
  /** Total receipts at the chosen mix, RM million, 2019 prices. */
  receipts_2019_prices_rm_million: number;
  /** Receipts if per-visitor yield equalled the 2019 anchor, RM million. */
  counterfactual_2019_prices_rm_million: number;
  /** counterfactual - receipts; POSITIVE = missing billions. */
  gap_2019_prices_rm_million: number;
  /** Per-market receipts contributions, RM million, 2019 prices. */
  contributions_2019_prices_rm_million: number[];
}

/**
 * THE arithmetic. Mirrors simulator.py::simulate_mix exactly — do not
 * "improve" the summation (no reduce-order tricks, no Kahan): the round-trip
 * test compares this bit-for-bit against the Python result.
 */
export function simulateMix(
  yieldsReal: number[],
  shares: number[],
  visitorArrivals: number,
  anchorPerVisitorReal: number
): SimResult {
  if (yieldsReal.length !== shares.length) {
    throw new Error("yields and shares must have the same length");
  }
  if (shares.some((s) => s < 0)) {
    throw new Error("shares must be non-negative");
  }
  let yieldPerVisitor = 0.0;
  for (let i = 0; i < shares.length; i++) {
    yieldPerVisitor += shares[i] * yieldsReal[i]; // left-to-right, same as Python
  }
  const contributions: number[] = [];
  for (let i = 0; i < shares.length; i++) {
    contributions.push((visitorArrivals * (shares[i] * yieldsReal[i])) / 1_000_000.0);
  }
  const receipts = (visitorArrivals * yieldPerVisitor) / 1_000_000.0;
  const counterfactual = (visitorArrivals * anchorPerVisitorReal) / 1_000_000.0;
  return {
    yield_per_visitor_real_rm: yieldPerVisitor,
    receipts_2019_prices_rm_million: receipts,
    counterfactual_2019_prices_rm_million: counterfactual,
    gap_2019_prices_rm_million: counterfactual - receipts,
    contributions_2019_prices_rm_million: contributions,
  };
}

/** Convenience wrapper: run the mix held on a fragment's own volumes/anchor. */
export function simulateFragmentMix(
  frag: SimulatorFragment,
  shares: number[]
): SimResult {
  return simulateMix(
    frag.markets.map((m) => m.yield_2024_real_2019_rm_per_visitor),
    shares,
    frag.visitor_arrivals_2024,
    frag.anchor_per_visitor_real_2019_rm
  );
}

// ---------------------------------------------------------------------------
// Presets. A preset is a SHARES vector (sums to 1 by construction); the UI
// turns shares back into slider weights. All rules are deterministic and
// stated in the UI.
// ---------------------------------------------------------------------------

export function shares2024(frag: SimulatorFragment): number[] {
  return frag.markets.map((m) => m.share_of_arrivals_2024);
}

export function shares2023(frag: SimulatorFragment): number[] {
  return frag.markets.map((m) => m.share_of_arrivals_2023);
}

// Policy preset rule (mirrors make_simulator_fixture.py::policy_mix): move this
// fraction of Singapore's 2024 share to the top-K markets by real 2019-price
// yield (excluding Singapore and the residual bucket), redistributed pro-rata
// by the recipients' own 2024 shares.
const POLICY_FROM_MARKET = "Singapore";
const POLICY_MOVE_FRACTION = 0.5;
const POLICY_TOP_K = 3;

export function policySingaporeShift(frag: SimulatorFragment): number[] {
  const shares = shares2024(frag);
  const fromI = frag.markets.findIndex((m) => m.market === POLICY_FROM_MARKET);
  if (fromI < 0) return shares;
  const ranked = frag.markets
    .map((m, i) => ({ i, yield: m.yield_2024_real_2019_rm_per_visitor, cov: m.coverage }))
    .filter(({ i, cov }) => cov === "both" && i !== fromI)
    .sort((a, b) => b.yield - a.yield);
  const recipients = ranked.slice(0, POLICY_TOP_K).map((r) => r.i);
  const move = shares[fromI] * POLICY_MOVE_FRACTION;
  const pool = recipients.reduce((sum, i) => sum + shares[i], 0);
  const out = [...shares];
  out[fromI] = shares[fromI] - move;
  for (const i of recipients) {
    out[i] = shares[i] + move * (shares[i] / pool);
  }
  return out;
}

/**
 * Turn shares into slider weights (percent points). The UI sliders hold raw
 * weights; effective shares are weight / total weight. A mix with zero total
 * weight falls back to uniform shares (never NaN).
 */
export function normalizeShares(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => w / total);
}

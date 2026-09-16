/**
 * Ticket #19 — UI-facing pure logic for the simulator page, on top of the
 * pinned arithmetic in ./simulator (never a replacement for it).
 *
 * - Slider weights are percent points (0-100 scale); effective shares are
 *   weight / total weight (see normalizeShares). Initial weights are the
 *   2024 observed shares; the page's reset buttons swap in either observed
 *   mix (2024 latest, 2023 earliest observed).
 * - The view model joins the simulator arithmetic to the per-market
 *   prescriptions, so the page renders ONE precomputed structure.
 * - No nominal figure appears here: the fragment yields are already
 *   constant-2019 RM, and only those are surfaced.
 */
import type { SimulatorFragment } from "./simulator";
import { normalizeShares, simulateFragmentMix, shares2023, shares2024 } from "./simulator";
import type { PrescriptionsData } from "./prescriptions";

/** Slider weight of one market, in percent points of total arrivals effort. */
export type MarketWeight = number;

/** Percent-point weights from a shares vector (e.g. a fragment's observed mix). */
export function weightsFromShares(shares: number[]): MarketWeight[] {
  return shares.map((s) => s * 100);
}

/** Clamp raw slider weights: non-negative, non-finite treated as zero. */
export function clampWeights(weights: MarketWeight[]): MarketWeight[] {
  return weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
}

export interface SimulatorViewRow {
  market: string;
  /** Slider weight in percent points, after clamping. */
  weight: number;
  /** Effective share of the mix, in percent, after renormalisation. */
  sharePct: number;
  /** Yield per visitor for this market, constant 2019 RM. */
  yieldReal2019: number;
  /** Receipts contribution at this mix, RM million, constant 2019 prices. */
  contributionRmMillion: number;
  /** Per-market prescription, or null when the segmentation has no verdict. */
  prescription: "grow" | "coast" | "reduce_reliance" | null;
  /** Cluster segment name behind the verdict, when one exists. */
  segmentName: string | null;
}

export interface SimulatorViewModel {
  /** Human label of the active mix — observed mixes are named, the rest is custom. */
  mixLabel: string;
  /** Effective shares (sum to 1) fed to the arithmetic. */
  shares: number[];
  /** Simulator arithmetic output at this mix (constant 2019 prices). */
  result: ReturnType<typeof simulateFragmentMix>;
  rows: SimulatorViewRow[];
}

const LABEL_TOLERANCE = 1e-9;

/**
 * Name the active mix. The observed mixes are recognised by comparing the
 * effective shares against the fragment's stored shares, so the label can
 * never drift from the numbers.
 */
export function mixLabelFor(frag: SimulatorFragment, weights: MarketWeight[]): string {
  const shares = normalizeShares(clampWeights(weights));
  for (const [year, observed] of [
    [frag.mix_year, shares2024(frag)],
    [frag.comparison_year, shares2023(frag)],
  ] as const) {
    if (
      shares.length === observed.length &&
      shares.every((s, i) => Math.abs(s - observed[i]) <= LABEL_TOLERANCE)
    ) {
      return `${year} observed mix`;
    }
  }
  return "Custom mix";
}

/** Full view model for the page: arithmetic + prescriptions joined per market. */
export function buildSimulatorView(
  frag: SimulatorFragment,
  rawWeights: MarketWeight[],
  prescriptions: PrescriptionsData
): SimulatorViewModel {
  const weights = clampWeights(rawWeights);
  const shares = normalizeShares(weights);
  const result = simulateFragmentMix(frag, shares);

  const verdicts = new Map(prescriptions.rows.map((r) => [r.market, r]));
  const rows: SimulatorViewRow[] = frag.markets.map((m, i) => {
    const verdict = verdicts.get(m.market) ?? null;
    return {
      market: m.market,
      weight: weights[i],
      sharePct: shares[i] * 100,
      yieldReal2019: m.yield_2024_real_2019_rm_per_visitor,
      contributionRmMillion: result.contributions_2019_prices_rm_million[i],
      prescription: verdict ? verdict.prescription : null,
      segmentName: verdict ? verdict.segmentName : null,
    };
  });

  return { mixLabel: mixLabelFor(frag, weights), shares, result, rows };
}

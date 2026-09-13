/**
 * Ticket T10: per-market prescriptions derived ONLY from the bundle's
 * source_segmentation fragment. Each clustered market gets one verdict:
 *
 * - grow            — the market sits in "High-Yield Long-Haul" (high wallet per
 *                     visitor) or "High-Growth Emerging" (fastest-growing segment);
 *                     each additional visitor adds disproportionate value.
 * - coast           — the market sits in "Low-Yield Steady": volume without value;
 *                     maintain current effort rather than chase arrivals growth.
 * - reduce_reliance — the market sits in "Volume Traps": the low-yield, high-volume
 *                     segment the arrivals KPI over-rewards. Per CONTEXT.md this is
 *                     a MEASUREMENT CRITIQUE of the KPI, never a judgement of the
 *                     market — the neutral label and rationale keep that framing.
 *
 * Unclustered markets (excluded from clustering) and any segment name no rule
 * covers get no verdict — the page says so instead of guessing. When the
 * segmentation fragment is absent the panel disappears; the page says so.
 */
import type { MarketSegment, SegmentationFragment, YieldTier } from "./bundle";

export type Prescription = "grow" | "coast" | "reduce_reliance";

/** Neutral, policymaker-facing labels. The Volume Traps verdict names the
 * traffic, not the market (CONTEXT.md framing contract). */
export const PRESCRIPTION_LABELS: Record<Prescription, string> = {
  grow: "Grow",
  coast: "Coast",
  reduce_reliance: "Reduce reliance on low-yield same-day traffic",
};

/** Segments that earn a "grow" verdict, by the settled rule. */
export const GROW_SEGMENTS = ["High-Yield Long-Haul", "High-Growth Emerging"] as const;
/** Segments that earn a "coast" verdict. */
export const COAST_SEGMENTS = ["Low-Yield Steady"] as const;
/** Segments that earn the "reduce reliance" verdict. */
export const REDUCE_SEGMENTS = ["Volume Traps"] as const;

export interface MarketPrescription {
  market: string;
  prescription: Prescription;
  segmentName: string;
  tier: YieldTier | null;
  tierLabel: string | null;
  yieldRmPerVisitor: number | null;
  arrivals2024: number | null;
  arrivalsGrowthPct: number | null;
  rationale: string;
}

export interface PrescriptionsData {
  anchorYear: number;
  available: boolean;
  rows: MarketPrescription[];
  /** Clustered markets whose segment no rule covers — shown, never guessed. */
  unrulySegments: string[];
  /** Markets excluded from clustering, with the fragment's stated reason. */
  unclustered: { market: string; excludedReason: string | null }[];
}

const ORDER: Prescription[] = ["reduce_reliance", "grow", "coast"];

function ruleFor(segmentName: string): Prescription | undefined {
  if ((GROW_SEGMENTS as readonly string[]).includes(segmentName)) return "grow";
  if ((COAST_SEGMENTS as readonly string[]).includes(segmentName)) return "coast";
  if ((REDUCE_SEGMENTS as readonly string[]).includes(segmentName)) return "reduce_reliance";
  return undefined;
}

const RATIONALES: Record<Prescription, string> = {
  grow:
    "High-yield or fast-growing segment: each additional visitor adds disproportionate value, so marketing and connectivity effort pays off here first.",
  coast:
    "Steady, lower-yield segment: arrivals without matching value. Maintain current effort rather than chase arrivals growth.",
  reduce_reliance:
    "Low-yield, high-volume segment: the arrivals KPI over-rewards exactly this short-stay traffic — a measurement critique of the headline indicator, not a judgement of the market. Growth here adds receipts but little yield.",
};

export function buildPrescriptions(segmentation: SegmentationFragment | undefined): PrescriptionsData {
  if (!segmentation) {
    return { anchorYear: 0, available: false, rows: [], unrulySegments: [], unclustered: [] };
  }

  const rows: MarketPrescription[] = [];
  const unruly = new Set<string>();
  const unclustered: { market: string; excludedReason: string | null }[] = [];

  for (const m of segmentation.markets) {
    if (!m.clustered) {
      unclustered.push({ market: m.market, excludedReason: m.excluded_reason ?? null });
      continue;
    }
    const segmentName = m.segment_name;
    if (!segmentName) {
      // malformed upstream — treat as unruly rather than inventing a verdict
      unruly.add("(unnamed cluster)");
      continue;
    }
    const prescription = ruleFor(segmentName);
    if (!prescription) {
      unruly.add(segmentName);
      continue;
    }
    rows.push({
      market: m.market,
      prescription,
      segmentName,
      tier: m.yield_tier ?? null,
      tierLabel: m.tier_label ?? null,
      yieldRmPerVisitor: m.yield_rm_per_visitor_2024 ?? null,
      arrivals2024: m.arrivals_persons_2024 ?? null,
      arrivalsGrowthPct: m.arrivals_growth_pct ?? null,
      rationale: RATIONALES[prescription],
    });
  }

  rows.sort(
    (a, b) =>
      ORDER.indexOf(a.prescription) - ORDER.indexOf(b.prescription) ||
      (b.yieldRmPerVisitor ?? -1) - (a.yieldRmPerVisitor ?? -1)
  );

  return {
    anchorYear: segmentation.anchor_year,
    available: true,
    rows,
    unrulySegments: [...unruly].sort(),
    unclustered,
  };
}

/** Segments are rendered in one place so the panel and its evidence stay aligned. */
export type { MarketSegment };

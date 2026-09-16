/**
 * Ticket #18: the source-market world map, rendered as PURE SVG from the
 * precomputed path set (scripts/generate-world-svg.mjs -> world-paths.generated.ts).
 * No runtime dependency, no network: shading is decided at render time from
 * the bundle via yieldShade() (the pipeline's own yield tiers); geometry is
 * static provenance, not a displayed figure.
 *
 * A server component — no client JS is shipped for the map.
 */
import type { MapMarket, YieldShade } from "@/lib/diagnosis";
import { yieldShade } from "@/lib/diagnosis";
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, WORLD_PATHS } from "@/lib/world-paths.generated";

const SHADE: Record<YieldShade, { fill: string; fillOpacity: number }> = {
  tier_top: { fill: "var(--primary)", fillOpacity: 0.9 },
  tier_upper: { fill: "var(--primary)", fillOpacity: 0.65 },
  tier_lower: { fill: "var(--primary)", fillOpacity: 0.4 },
  tier_bottom: { fill: "var(--primary)", fillOpacity: 0.18 },
  unclustered: { fill: "var(--chart-4)", fillOpacity: 0.45 },
  no_yield: { fill: "var(--muted)", fillOpacity: 0.9 },
};

const BACKGROUND = { fill: "var(--muted)", fillOpacity: 0.35 };

function marketTooltip(m: MapMarket): string {
  const parts = [m.market];
  parts.push(
    m.yieldRmPerVisitor === null
      ? "no yield in the bundle"
      : `RM${m.yieldRmPerVisitor.toLocaleString("en-US", { maximumFractionDigits: 0 })} tourism yield per visitor (${m.yieldYear ?? "year not stated"})`
  );
  if (m.tierLabel) parts.push(m.tierLabel);
  if (m.segmentName) parts.push(`segment: ${m.segmentName}`);
  if (m.coverage !== "both") parts.push(`coverage: ${m.coverage.replace("_", " ")}`);
  return parts.join(" — ");
}

export function YieldMap({
  markets,
  className,
}: {
  markets: MapMarket[];
  className?: string;
}) {
  const byGeoName = new Map(markets.map((m) => [m.geoName, m]));
  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
        role="img"
        aria-label="World map shaded by tourism yield per source market (2024)"
        className="h-auto w-full"
      >
        {WORLD_PATHS.map((p) => {
          const market = byGeoName.get(p.name);
          const style = market ? SHADE[yieldShade(market)] : BACKGROUND;
          return (
            <path
              key={p.name}
              d={p.d}
              fill={style.fill}
              fillOpacity={style.fillOpacity}
              fillRule="evenodd"
              stroke="var(--border)"
              strokeWidth={0.4}
            >
              {market && <title>{marketTooltip(market)}</title>}
            </path>
          );
        })}
      </svg>
    </figure>
  );
}

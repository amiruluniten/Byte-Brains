import { BundleFooter } from "@/components/layout/footer/bundle-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YieldMap } from "@/components/charts/yield-map";
import { Badge } from "@/components/ui/badge";
import { buildMarketMapData, buildMarketRanking, filterMissingFromGeometry } from "@/lib/diagnosis";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";
import { WORLD_PATHS } from "@/lib/world-paths.generated";

/**
 * /diagnosis/source-markets (ticket #18): markets ranked by tourism yield,
 * with the world map shaded by the pipeline's own yield tiers and the named
 * clusters from the segmentation fragment. The map renders as pure SVG from
 * the precomputed, committed path set (see scripts/generate-world-svg.mjs) —
 * zero network, zero new runtime dependencies. Every figure is computed at
 * render time from the bundle.
 */
export default function SourceMarketsPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const { bundle } = loaded;
  const sm = bundle.fragments.source_market;
  const seg = bundle.fragments.source_segmentation;
  if (!sm) {
    return (
      <ErrorNotice message="The bundle has no source_market fragment — the source-market yield ranking cannot be shown." />
    );
  }
  const mapData = buildMarketMapData(sm, seg);
  const ranked = buildMarketRanking(mapData);
  const geometryNames = new Set(WORLD_PATHS.map((p) => p.name));
  const missing = filterMissingFromGeometry(mapData, geometryNames);
  // The year the yields were read at, from the bundle (never hardcoded).
  const yieldYears = [...new Set(mapData.markets.map((m) => m.yieldYear).filter((y): y is number => y !== null))];
  const yieldYearLabel = yieldYears.length === 1 ? ` ${yieldYears[0]}` : "";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-10">
      <header className="flex flex-col gap-3">
        <p className="font-medium text-muted-foreground text-sm">Diagnosis</p>
        <h1 className="font-semibold text-3xl tracking-tight">Source markets: who carries the value</h1>
        <p className="text-muted-foreground">
          Top source markets ranked by tourism yield — receipts per visitor{yieldYearLabel ? `, ${yieldYearLabel}` : ""} — with the world map shaded by
          the yield tiers from the k-means segmentation. Same-day-heavy, low-yield markets are the Volume Trap made
          geographic.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl tracking-tight">Tourism yield by source market</h2>
          <p className="text-muted-foreground text-sm">
            Hover a shaded country for its yield, tier and segment. Shading: darker = higher-yield tier (the
            pipeline&rsquo;s quartile tiers); grey = a market with no 2024 yield in the bundle; light grey = countries
            outside the bundle.
          </p>
        </div>
        {missing.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Markets with no matching geometry entity (not shaded): {missing.join("; ")}.
          </p>
        )}
        <YieldMap markets={mapData.markets} className="rounded-lg border p-4" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">Ranked by yield</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Source market</TableHead>
              <TableHead className="text-right">Yield{yieldYearLabel} (RM/visitor)</TableHead>
              <TableHead className="text-right">Arrivals{yieldYearLabel}</TableHead>
              <TableHead>Yield tier</TableHead>
              <TableHead>Segment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((m) => (
              <TableRow key={m.market}>
                <TableCell className="text-muted-foreground">{m.rank ?? "—"}</TableCell>
                <TableCell className="font-medium">{m.market}</TableCell>
                <TableCell className="text-right">
                  {m.yieldRmPerVisitor === null
                    ? "no yield in bundle"
                    : m.yieldRmPerVisitor.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-right">
                  {m.arrivals2024 === null ? "—" : m.arrivals2024.toLocaleString("en-US")}
                </TableCell>
                <TableCell>{m.tierLabel ?? "—"}</TableCell>
                <TableCell>
                  {m.segmentName ?? "—"}
                  {m.excludedReason && (
                    <p className="text-muted-foreground text-xs">excluded from clustering: {m.excludedReason}</p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {seg && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-2xl tracking-tight">Named clusters &amp; yield tiers</h2>
            <p className="text-muted-foreground text-sm">
              {seg.n_clusters} clusters from k-means ({seg.method}, seed {seg.seed}), named by rule-based profiles —
              never machine ids. Tiers are quartiles of the same emitted {seg.anchor_year} yields.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {seg.clusters.map((c) => (
              <Card key={c.cluster_id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {c.segment_name}
                    <Badge variant="secondary">
                      mean yield RM{c.mean_yield_rm_per_visitor.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="text-muted-foreground">{c.naming_rationale}</p>
                  <p className="text-muted-foreground text-xs">Members: {c.members.join(", ")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {Object.values(seg.tier_labels).map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {Object.keys(seg.tier_labels).map((tier) => (
                  <TableCell key={tier}>
                    {ranked
                      .filter((m) => m.tier === tier)
                      .map((m) => m.market)
                      .join(", ") || "—"}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </section>
      )}

      <BundleFooter bundle={bundle} />
    </main>
  );
}

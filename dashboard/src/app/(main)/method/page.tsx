import { BundleFooter } from "@/components/layout/footer/bundle-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Bundle } from "@/lib/bundle";
import { buildDecomposition, buildMethodIndex } from "@/lib/diagnosis";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";

/**
 * Method & sources page (ticket #17): a judge can follow the methodology and
 * check every source without asking the team. Data-only prose + tables; every
 * figure is computed at render time from the bundle, and the bundle's own
 * sources metadata drives the source tables. Substance follows the report
 * pack's method notes (report-pack/2-method-notes.md); the wording stays in
 * CONTEXT.md vocabulary.
 */
export default function MethodPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const { bundle } = loaded;
  const mb = bundle.fragments.missing_billions;
  const index = buildMethodIndex(bundle);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">Method &amp; sources</h1>
        <p className="text-muted-foreground">
          Official DOSM and Tourism Malaysia publications were parsed into a versioned, checksum-validated data bundle;
          tourism yield was computed per source market from a single publication&rsquo;s receipts and arrivals; a
          constant-2019-prices counterfactual (national CPI deflator) measured the value not created per visitor;
          k-means clustering on eight standardised market traits named four actionable segments; and a transparent
          mix-shift simulator turns the segments into prescriptions.
        </p>
      </header>

      {mb && <CounterfactualSection mb={mb} />}

      <YieldSection />

      <SegmentationSection index={index} />

      <RegionalSection index={index} />

      <ScopeSection />

      <DataIntegrationSection bundle={bundle} />

      <SourcesSection index={index} bundle={bundle} />

      <BundleFooter bundle={bundle} />
    </main>
  );
}

/* ------------------------------------------------------------------ */

/** Sign convention + anchor figures, all read from the fragment at render. */
function CounterfactualSection({ mb }: { mb: NonNullable<BundleFragments["missing_billions"]> }) {
  const decomp = buildDecomposition(mb);
  const anchor = decomp.stagnation.anchorPerVisitorRealRm;
  const rows = [...mb.years].sort((a, b) => a.year - b.year);
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtP = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const preliminary = rows.filter((y) => y.revision_status === "preliminary").map((y) => `${y.year}p`);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-2xl tracking-tight">The Missing Billions counterfactual</h2>
      <div className="flex flex-col gap-3 text-muted-foreground text-sm">
        <p>
          <strong className="text-foreground">The question.</strong> What would receipts have been if each visitor had
          been worth what a 2019 visitor was worth, in real terms?
        </p>
        <p>
          <strong className="text-foreground">The arithmetic.</strong> (1) Per-visitor expenditure each year = receipts
          &divide; visitor arrivals &mdash; the {mb.anchor_year} anchor is RM
          {fmtP(anchor)} per visitor. (2) Deflate to {mb.anchor_year} purchasing power with the national CPI (index base{" "}
          {mb.deflator.index_base}, anchor index {mb.deflator.anchor_index}). (3) Counterfactual receipts = actual
          arrivals &times; the {mb.anchor_year} real per-visitor yield. (4) Real gap = counterfactual &minus; actual.
          Sign convention: positive = missing billions.
        </p>
        <p>
          <strong className="text-foreground">Prices rule.</strong> The gap exists ONLY in constant {mb.anchor_year}{" "}
          prices. The bundle also emits the naive nominal twin, flagged INVALID (ringgit of different years are not
          comparable) — it is never shown as a comparison on any page.
          {preliminary.length > 0 && (
            <>
              {" "}
              Preliminary years ({preliminary.join(", ")}) are labelled with a &ldquo;p&rdquo; everywhere and never
              stand in for final data.
            </>
          )}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead className="text-right">Receipts (nominal RM million)</TableHead>
            <TableHead className="text-right">Visitor arrivals</TableHead>
            <TableHead className="text-right">Per visitor, real {mb.anchor_year} RM</TableHead>
            <TableHead className="text-right">Real gap ({mb.anchor_year} prices, RM million)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((y) => (
            <TableRow key={y.year}>
              <TableCell>{y.revision_status === "preliminary" ? `${y.year}p` : y.year}</TableCell>
              <TableCell className="text-right">{fmt(y.receipts_nominal_rm_million)}</TableCell>
              <TableCell className="text-right">{y.visitor_arrivals.toLocaleString("en-US")}</TableCell>
              <TableCell className="text-right">{fmtP(y.per_visitor_real_2019_rm)}</TableCell>
              <TableCell className="text-right">
                {y.gap_2019_prices_rm_million >= 0 ? "+" : ""}
                {fmt(y.gap_2019_prices_rm_million)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        Headline (pre-registered window {mb.headline.window}, constant {mb.anchor_year} prices): RM
        {fmt(mb.headline.cumulative_gap_rm_million)} million. {mb.headline.basis_note}
        {mb.supplementary
          ? ` Supplementary only, never the headline: ${mb.supplementary.label} (RM${fmt(mb.supplementary.cumulative_gap_rm_million)} million, ${mb.supplementary.window}).`
          : ""}
      </p>
    </section>
  );
}

/** Tourism yield: the definition and how it is computed per source market. */
function YieldSection() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-2xl tracking-tight">Tourism yield</h2>
      <div className="flex flex-col gap-3 text-muted-foreground text-sm">
        <p>
          <strong className="text-foreground">Definition.</strong> Tourism yield is the economic value generated per
          visitor: per-capita expenditure over the length of stay. This project measures it directly and defensibly as
          visitor receipts from a source market &divide; visitor arrivals from that market, both from the same
          publication and the same year, so numerator and denominator share one methodology.
        </p>
        <p>
          <strong className="text-foreground">How to read it.</strong> Yield is a quality-of-demand measure. A low-yield
          source market is not a failure of its visitors &mdash; it reflects the mix of same-day visitor traffic
          (under-24-hour trips, e.g. across a land border), which counts in arrivals but generates low yield. That
          measurement critique &mdash; arrival-count KPIs reward low-yield same-day traffic &mdash; is the Volume Trap.
        </p>
        <p>
          <strong className="text-foreground">Basis discipline.</strong>
          Tourist (overnight) and visitor-basis series are never merged: every table and chart states its counting basis
          and window.
        </p>
      </div>
    </section>
  );
}

/** Segmentation + prescriptions, using the bundle's own method strings. */
function SegmentationSection({ index }: { index: ReturnType<typeof buildMethodIndex> }) {
  const seg = index.entries.filter((e) => e.fragment === "source_segmentation");
  const rx = index.entries.filter((e) => e.fragment === "per_market_prescriptions");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-2xl tracking-tight">Market segmentation &amp; prescriptions</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {seg.map((e) => (
          <Card key={e.fragment}>
            <CardHeader>
              <CardTitle className="text-base">Segmentation (k-means)</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{e.method}</CardContent>
          </Card>
        ))}
        {rx.map((e) => (
          <Card key={e.fragment}>
            <CardHeader>
              <CardTitle className="text-base">Per-market prescriptions</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{e.method}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** The regional benchmark is supporting context, never the headline. */
function RegionalSection({ index }: { index: ReturnType<typeof buildMethodIndex> }) {
  const rb = index.entries.filter((e) => e.fragment === "regional_benchmark");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-2xl tracking-tight">Regional benchmark (supporting context)</h2>
      <div className="flex flex-col gap-3 text-muted-foreground text-sm">
        {rb.map((e) => (
          <p key={e.fragment}>{e.method}</p>
        ))}
        <p>The regional gap is supporting context for the yield story — it is never the headline.</p>
      </div>
    </section>
  );
}

/** Scope & limits, so a judge knows exactly what the numbers cover. */
function ScopeSection() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-2xl tracking-tight">Scope &amp; limits</h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground text-sm">
        <li>
          Population: inbound international visitors to Malaysia only. Domestic visitors are out of scope &mdash; the
          official inbound tables do not cover them.
        </li>
        <li>
          The anchor year (2019) is the official pre-crisis baseline: a measuring stick for the stagnation line, not a
          target to revert to.
        </li>
        <li>
          Source markets: the top-20 markets in Tourism Malaysia&rsquo;s Statistics in Brief 2024. Markets missing one
          side of the yield division keep explicit nulls (never zeroed) and are excluded from the segmentation with
          stated reasons.
        </li>
        <li>
          Prices: the Missing Billions exists only in constant 2019 prices; the nominal gap is emitted flagged INVALID.
        </li>
        <li>
          Deflation: a single national CPI deflator is applied to all receipts; no market-level price indices exist in
          the official series.
        </li>
        <li>
          Known limitation: the counterfactual uses the national average per-visitor yield, so it combines the change in
          each source market&rsquo;s yield with the change in the market mix; separating the two effects is future work.
        </li>
      </ul>
    </section>
  );
}

type BundleFragments = Bundle["fragments"];

/** Which datasets produced which insight (bundle sources metadata). */
function DataIntegrationSection({ bundle }: { bundle: Bundle }) {
  const f = bundle.fragments;
  const rows: { combined: string; insight: string }[] = [
    {
      combined:
        "Tourism Satellite Account inbound consumption &times; national CPI series &times; visitor-basis arrivals",
      insight: "The Missing Billions counterfactual and the stagnation line",
    },
    ...(f.source_market
      ? [
          {
            combined: "Tourism Malaysia per-market receipts &times; per-market arrivals (same publication, same year)",
            insight: "Per-source-market tourism yield — which markets carry value, which carry volume",
          },
        ]
      : []),
    ...(f.source_market && f.source_segmentation
      ? [
          {
            combined: "Per-market yield & volume × WEF Travel & Tourism Development Index market traits",
            insight: "The market segmentation — named clusters and yield tiers",
          },
        ]
      : []),
    ...(f.regional_benchmark
      ? [
          {
            combined: "TSA tourism yield &times; regional official published figures",
            insight: "The regional yield benchmark (supporting context, never the headline)",
          },
        ]
      : []),
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-2xl tracking-tight">Data integration</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datasets combined</TableHead>
            <TableHead>Insight produced</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.insight}>
              <TableCell>{r.combined}</TableCell>
              <TableCell>{r.insight}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

/** Every fragment's method + exact source rows; raw files with sha256. */
function SourcesSection({ index, bundle }: { index: ReturnType<typeof buildMethodIndex>; bundle: Bundle }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-semibold text-2xl tracking-tight">Sources</h2>
      <div className="flex flex-col gap-4">
        {index.entries.map((e) => (
          <div key={`${e.fragment}-${e.ticket}`} className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {e.fragment} <span className="text-muted-foreground">({e.ticket})</span>
            </p>
            <p className="text-muted-foreground">{e.method}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground text-xs">
              {e.sources.map((s) => (
                <li key={`${s.label}${s.url ?? ""}`}>
                  {s.url ? (
                    <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">Rendered on: {e.usedBy.join(", ")}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium text-sm">Raw files hashed into this bundle (sha256)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>sha256</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(bundle.sources).map(([file, sha]) => (
              <TableRow key={file}>
                <TableCell>{file}</TableCell>
                <TableCell>
                  <code className="break-all text-xs">{sha}</code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">
        Bundle v{index.bundleVersion} &middot; schema {index.schemaVersion} &middot; generated {index.generatedUtc}{" "}
        &middot; sha256 <code className="break-all">{index.checksum}</code>. The report pack pins the same digest (see
        report-pack/pinned-bundle.md).
      </p>
    </section>
  );
}

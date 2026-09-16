import { TraceChart, type TraceSpec } from "@/components/charts/trace-chart";
import { BundleFooter } from "@/components/layout/footer/bundle-footer";
import { Badge } from "@/components/ui/badge";
import {
  buildDecomposition,
  buildNaiveNominalGapSeries,
  flagNaiveNominalGap,
  nominalSeriesNotice,
} from "@/lib/diagnosis";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";

/**
 * /diagnosis/decomposition (ticket #18): extensive (volume) vs intensive
 * (value) growth, from the missing_billions fragment — the same real-terms
 * arithmetic as the Missing Billions headline. The nominal traces carry an
 * explicit nominal-vs-real label, and the naive nominal gap appears ONLY
 * inside a flagged INVALID card (honesty watch items from the #16 review).
 * Every figure is computed at render time from the bundle.
 */
export default function DecompositionPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const { bundle } = loaded;
  const mb = bundle.fragments.missing_billions;
  if (!mb) {
    return <ErrorNotice message="The bundle has no missing_billions fragment — the decomposition cannot be shown." />;
  }
  const decomp = buildDecomposition(mb);
  const indexedTraces: TraceSpec[] = decomp.indexed.map((t) => ({
    name: t.name,
    unit: t.unit,
    points: t.points,
    notice: nominalSeriesNotice(t),
    invalid: /nominal/i.test(t.name),
  }));
  const perVisitorTraces: TraceSpec[] = decomp.perVisitor.map((t) => ({
    name: t.name,
    unit: t.unit,
    points: t.points,
    notice: nominalSeriesNotice(t),
    invalid: /nominal/i.test(t.name),
  }));
  const naiveSeries = buildNaiveNominalGapSeries(mb);
  const invalidFlagged: TraceSpec[] = [
    {
      name: `${naiveSeries.unit.split(" (")[0]} by year (INVALID — shown flagged, never a comparison)`,
      unit: naiveSeries.unit,
      points: naiveSeries.points,
      notice: naiveSeries.notice,
      invalid: true,
    },
  ];
  const latestRow = [...mb.years].sort((a, b) => b.year - a.year)[0];
  const latestNaive = flagNaiveNominalGap(latestRow);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-10">
      <header className="flex flex-col gap-3">
        <p className="font-medium text-muted-foreground text-sm">Diagnosis</p>
        <h1 className="font-semibold text-3xl tracking-tight">Decomposition: extensive vs intensive growth</h1>
        <p className="text-muted-foreground">
          Did tourism recover by adding <strong>visitors</strong> (extensive) or by adding{" "}
          <strong>value per visitor</strong> (intensive)? Volume and value are indexed to the {decomp.anchorYear} anchor
          and paired with the per-visitor series the Missing Billions counterfactual rests on — every figure computed
          from the bundle at render time.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
          <p className="font-medium text-sm">Headline (pre-registered, window-guarded)</p>
          <p className="font-semibold text-2xl">
            RM
            {decomp.headline.cumulativeGapRmMillion.toLocaleString("en-US", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            &nbsp;million
          </p>
          <p className="text-muted-foreground text-sm">
            Cumulative gap {decomp.headline.window.from}&ndash;{decomp.headline.window.to}, constant {decomp.anchorYear}{" "}
            prices. {decomp.headline.basisNote}
          </p>
        </div>
        {decomp.supplementary && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4">
            <p className="font-medium text-sm">Supplementary only &mdash; never the headline</p>
            <p className="font-semibold text-2xl">
              RM
              {decomp.supplementary.cumulativeGapRmMillion.toLocaleString("en-US", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              &nbsp;million
            </p>
            <p className="text-muted-foreground text-sm">{decomp.supplementary.label}</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl tracking-tight">
            Volume vs value, indexed ({decomp.anchorYear} = 100)
          </h2>
          <p className="text-muted-foreground text-sm">
            The extensive side is visitor arrivals; the intensive side is receipts. Bases are labelled and never merged.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <TraceChart traces={indexedTraces} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl tracking-tight">Per visitor: nominal vs real</h2>
          <p className="text-muted-foreground text-sm">
            What a visitor was worth each year — in that year&rsquo;s ringgit (nominal) and in {decomp.anchorYear} money
            (real). The stagnation line lives in the real series.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <TraceChart traces={perVisitorTraces} />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-xl tracking-tight">The naive nominal gap</h2>
          <Badge variant="destructive">INVALID &mdash; nominal</Badge>
        </div>
        <p className="text-destructive text-sm">{latestNaive.notice}</p>
        <p className="text-muted-foreground text-sm">
          The bundle parses the naive nominal twin of the headline ( <code>naive_nominal_gap_rm_million</code>) and
          emits it flagged INVALID. It is shown here — flagged, in the INVALID treatment — only to make the false
          surplus visible. It is never a comparison and never a headline.
        </p>
        <div className="rounded-lg border p-4">
          <TraceChart traces={invalidFlagged} />
        </div>
        <p className="text-muted-foreground text-xs">
          Latest row: naive nominal gap {latestNaive.display} — {latestNaive.flag}.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Basis notes</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          {decomp.basisNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <BundleFooter bundle={bundle} />
    </main>
  );
}

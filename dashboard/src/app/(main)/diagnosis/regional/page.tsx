import { BundleFooter } from "@/components/layout/footer/bundle-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildRegionalComparison } from "@/lib/diagnosis";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";

/**
 * /diagnosis/regional (ticket #18): the regional yield comparison — Malaysia
 * vs Thailand and Indonesia, from the regional_benchmark fragment. SUPPORTING
 * CONTEXT ONLY, never the headline; every row carries its receipts basis
 * (survey vs balance-of-payments vs administrative) so the comparison is
 * honest about what is being measured.
 */
export default function RegionalPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const { bundle } = loaded;
  const frag = bundle.fragments.regional_benchmark;
  if (!frag) {
    return (
      <ErrorNotice message="The bundle has no regional_benchmark fragment — the regional comparison cannot be shown." />
    );
  }
  const comp = buildRegionalComparison(frag);
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-10">
      <header className="flex flex-col gap-3">
        <p className="font-medium text-muted-foreground text-sm">Diagnosis</p>
        <h1 className="font-semibold text-3xl tracking-tight">Regional yield comparison</h1>
        <p className="text-muted-foreground">
          Malaysia&rsquo;s per-visitor receipts against its neighbours&rsquo;, {comp.anchorYear} vs{" "}
          {comp.baselineYear}. This is <strong>supporting context only &mdash; never the headline</strong>: the
          Missing Billions counterfactual is the headline, and it is computed from Malaysia&rsquo;s own series.
        </p>
      </header>

      <section className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="text-muted-foreground">
          <strong className="text-foreground">Methodology caveats.</strong> The three countries measure receipts on
          different bases, so the yields are comparable in direction, not in precision. The basis of each row travels
          with it (survey = visitor expenditure survey; balance of payments = administrative; administrative aggregate).
          {comp.caveats.map((c) => (
            <span key={c}>
              {" "}
              {c}
            </span>
          ))}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">Yield per visitor, {comp.anchorYear}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Yield {comp.anchorYear} (USD/visitor)</TableHead>
              <TableHead className="text-right">vs {comp.baselineYear}</TableHead>
              <TableHead className="text-right">&times; Malaysia {comp.anchorYear}</TableHead>
              <TableHead className="text-right">Arrivals {comp.anchorYear}</TableHead>
              <TableHead className="text-right">Receipts {comp.anchorYear} (USD bn)</TableHead>
              <TableHead>Receipts basis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comp.rows.map((r) => (
              <TableRow key={r.country} className={r.isBaseline ? "bg-muted/40" : undefined}>
                <TableCell className="font-medium">
                  {r.country}
                  {r.isBaseline && <span className="ml-2 text-muted-foreground text-xs">(baseline)</span>}
                </TableCell>
                <TableCell className="text-right">${fmt(r.yield2024Usd)}</TableCell>
                <TableCell className="text-right">
                  {r.changePct >= 0 ? "+" : ""}
                  {fmt(r.changePct)}%
                </TableCell>
                <TableCell className="text-right">{r.multipleOfMalaysia === null ? "—" : `${fmt(r.multipleOfMalaysia)}&times;`}</TableCell>
                <TableCell className="text-right">{r.arrivals2024.toLocaleString("en-US")}</TableCell>
                <TableCell className="text-right">{fmt(r.usdBillion2024)}</TableCell>
                <TableCell>
                  <span className="text-xs">{r.receiptsBasisLabel}</span>
                  <p className="text-muted-foreground text-xs">{r.receiptsBasisNote}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl tracking-tight">Sources &amp; excluded markets</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {comp.rows.map((r) => (
            <Card key={r.country}>
              <CardHeader>
                <CardTitle className="text-base">{r.country}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-muted-foreground text-xs">
                {r.sourceUrls.map((u) => (
                  <a key={u} href={u} className="break-all underline underline-offset-4">
                    {u}
                  </a>
                ))}
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Excluded markets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-muted-foreground text-xs">
              {comp.excluded.length === 0 && <p>None.</p>}
              {comp.excluded.map((e) => (
                <p key={e.country}>
                  <span className="text-foreground">{e.country}</span> — {e.reason}
                </p>
              ))}
              <p className="mt-1">Reference doc: {comp.researchDoc}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <BundleFooter bundle={bundle} />
    </main>
  );
}

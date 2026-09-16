import { SpecChart } from "@/components/charts/spec-chart";
import { BundleFooter } from "@/components/layout/footer/bundle-footer";
import { type Bundle, type MissingBillionsFragment } from "@/lib/bundle";
import { buildDecomposition } from "@/lib/diagnosis";
import {
  buildArrivalsChart,
  buildReceiptsChart,
  buildVisitorSplitChart,
} from "@/lib/chart-data";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";

/**
 * Landing page (ticket #17): the judge-ready story — the Missing Billions
 * headline, the stagnation line, arrivals vs receipts side by side, and the
 * tourist vs same-day visitor split. Every figure is computed at render time
 * from the synced bundle; nothing below is hardcoded. The supplementary +
 * honesty-guards blocks from #16 are kept (approved scope).
 */
export default function Home() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) {
    return <ErrorNotice message={loaded.message} />;
  }
  const { bundle } = loaded;
  const mb = bundle.fragments.missing_billions;
  if (!mb) {
    return (
      <ErrorNotice message="The bundle has no missing_billions fragment — the headline counterfactual cannot be shown." />
    );
  }
  const decomp = buildDecomposition(mb);
  const headlineGap = fmt(mb.headline.cumulative_gap_rm_million);
  const supplementary = mb.supplementary;
  // 2025 rows are preliminary: label them "2025p", never quote them as final.
  const preliminaryYears = mb.years
    .filter((y) => y.revision_status === "preliminary")
    .map((y) => `${y.year}p`);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-10">
      <HeadlineSection bundle={bundle} mb={mb} decomp={decomp} headlineGap={headlineGap} />

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Extensive side: visitor arrivals"
          caption="Growth from more visitors. Each trace states its counting basis and window — bases are never merged."
          spec={buildArrivalsChart(bundle)}
        />
        <ChartCard
          title="Intensive side: tourism receipts"
          caption="Growth from more value per visitor. Inbound tourism consumption, RM million, tourist basis."
          spec={buildReceiptsChart(bundle)}
        />
      </section>

      <VolumeTrapSection mb={mb} spec={buildVisitorSplitChart(bundle)} />

      <section className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <p>
          <strong>Honesty guards:</strong> gaps are quoted ONLY in constant 2019
          prices; the nominal gap is INVALID (inflation + volume flatter it) and
          is never shown as a comparison.
        </p>
        {preliminaryYears.length > 0 && (
          <p>
            Preliminary years in the bundle are always labelled{" "}
            {preliminaryYears.join(", ")} — they never stand in for final data.
          </p>
        )}
        {supplementary && (
          <p>
            {supplementary.label} (RM
            {supplementary.cumulative_gap_rm_million.toLocaleString("en-US", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            million, {supplementary.window}) — supplementary only, never the
            headline.
          </p>
        )}
      </section>

      <BundleFooter bundle={bundle} />
    </main>
  );
}

/** Format an RM-million figure with one decimal, thousands separators. */
function fmt(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function HeadlineSection({
  bundle,
  mb,
  decomp,
  headlineGap,
}: {
  bundle: Bundle;
  mb: MissingBillionsFragment;
  decomp: ReturnType<typeof buildDecomposition>;
  headlineGap: string;
}) {
  // The stagnation line, computed from the bundle: 2024 real per-visitor
  // receipts vs the 2019 anchor (the diagnosis lib's guarded pairing).
  const { stagnation } = decomp;
  const changePct =
    ((stagnation.latestPerVisitorRealRm - stagnation.anchorPerVisitorRealRm) /
      stagnation.anchorPerVisitorRealRm) *
    100;
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">
        Malaysia&rsquo;s tourism recovery measured visitors, not value.
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        The Missing Billions: RM{headlineGap}&nbsp;million
      </h1>
      <p className="text-muted-foreground">
        Cumulative gap {mb.headline.window}, constant 2019 prices: receipts that
        would have existed had every visitor been worth a 2019 visitor, minus
        actual receipts (recomputed from the TSA 2025 revised receipts).
        Positive = missing billions.
      </p>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">The stagnation line</p>
        <p className="text-muted-foreground">
          By {stagnation.latestYear}, each visitor was worth what a 2019 visitor
          was worth: RM
          {stagnation.latestPerVisitorRealRm.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          real per visitor against the 2019 anchor of RM
          {stagnation.anchorPerVisitorRealRm.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          ({changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%, constant 2019 prices). The recovery added
          visitors and prices — not value per visitor.
        </p>
      </div>
    </section>
  );
}

function VolumeTrapSection({
  mb,
  spec,
}: {
  mb: MissingBillionsFragment;
  spec: ReturnType<typeof buildVisitorSplitChart>;
}) {
  const vt = mb.volume_trap;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">{spec.title}</h2>
        <p className="text-sm text-muted-foreground">{spec.subtitle}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <SpecChart spec={spec} />
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <p className="font-medium">Why the arrivals KPI misleads</p>
          <p className="text-muted-foreground">
            The same-day visitor share of arrivals rose from{" "}
            {vt.excursionist_share_2019_pct.toFixed(1)}% in 2019 to{" "}
            {vt.excursionist_share_2024_pct.toFixed(1)}% in 2024 (+
            {vt.excursionist_share_change_pp.toFixed(1)} pp) — arrivals that
            count in the KPI but generate low tourism yield. In 2024,{" "}
            {vt.land_mode_share_2024_pct.toFixed(1)}% of visitor arrivals
            entered by land.
          </p>
          <p className="text-muted-foreground">
            Arrival-count KPIs reward this traffic, so policy optimises for
            heads instead of value — the Volume Trap. The receipts chart above
            shows the value side the KPI never sees.
          </p>
          <p className="text-xs text-muted-foreground">
            Land-mode share source: {vt.land_mode_share_source}.
          </p>
        </div>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  caption,
  spec,
}: {
  title: string;
  caption: string;
  spec: ReturnType<typeof buildArrivalsChart>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      <SpecChart spec={spec} />
    </div>
  );
}

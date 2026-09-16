import { APP_CONFIG } from "@/config/app-config";
import { ErrorNotice, loadBundleForPages } from "@/lib/server-bundle";

/**
 * Minimal landing page (ticket #16): the Missing Billions headline and the
 * bundle version + checksum footer, read live from the synced bundle at
 * render time. Data-only; the designed routes land in later tickets.
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
  const headline = mb.headline;
  const gap = headline.cumulative_gap_rm_million.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const supplementary = mb.supplementary;
  // 2025 rows are preliminary: label them "2025p", never quote them as final.
  const preliminaryYears = mb.years.filter((y) => y.revision_status === "preliminary").map(
    (y) => `${y.year}p`
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Malaysia&rsquo;s tourism recovery measured visitors, not value.
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          The Missing Billions: RM{gap}&nbsp;million
        </h1>
        <p className="text-muted-foreground">
          Cumulative gap {headline.window}, constant 2019 prices: receipts that
          would have existed had every visitor been worth a 2019 visitor, minus
          actual receipts (recomputed from the TSA 2025 revised receipts).
          Positive = missing billions.
        </p>
      </section>

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

      <footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
        <span>{APP_CONFIG.copyright}</span>
        <span>
          Data bundle v{bundle.bundle_version} &middot; schema{" "}
          {bundle.schema_version} &middot; sha256{" "}
          <code className="break-all">{bundle.checksum}</code> &middot;
          generated {bundle.generated_utc}
        </span>
      </footer>
    </main>
  );
}

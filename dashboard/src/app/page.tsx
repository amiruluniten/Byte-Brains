import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BundleLoadError, loadBundleFromString } from "../lib/bundle";
import { buildArrivalsChart, buildReceiptsChart } from "../lib/chart-data";
import NationalChart from "../components/NationalCharts";
import { buildDecomposition } from "../lib/diagnosis";

/**
 * Landing page — static export. The bundle is read from disk HERE, at build
 * time (the single seam: pipeline writes it, dashboard reads it, nothing else
 * crosses). There is no runtime data fetching anywhere in this app.
 *
 * Failure mode contract (ticket T2): a missing or corrupt bundle renders a
 * clear error notice, never a blank page.
 */

function loadBundle(): { ok: true; raw: string } | { ok: false; message: string } {
  const bundlePath = join(process.cwd(), "data", "bundle.json");
  try {
    const raw = readFileSync(bundlePath, "utf8");
    loadBundleFromString(raw); // full validation incl. checksum
    return { ok: true, raw };
  } catch (e) {
    if (e instanceof BundleLoadError) return { ok: false, message: e.message };
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        message:
          "Data bundle not found. Run the pipeline first (cd pipeline && .venv/bin/tsa-pipeline) to produce data/processed/bundle.json.",
      };
    }
    return { ok: false, message: `Unexpected error loading the data bundle: ${(e as Error).message}` };
  }
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ color: "#ff6b6b" }}>Dashboard cannot show data</h1>
      <p>
        The data bundle failed to load or validate. Nothing below is shown on
        purpose — no made-up or stale numbers.
      </p>
      <pre
        style={{
          background: "#1c1f27",
          border: "1px solid #ff6b6b",
          borderRadius: 8,
          padding: "1rem",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message}
      </pre>
      <p style={{ color: "#9aa0a6" }}>
        Fix: re-run the pipeline (<code>.venv/bin/tsa-pipeline</code>), then
        rebuild the dashboard (<code>npm run build</code> in <code>dashboard/</code>).
      </p>
    </main>
  );
}

export default function Home() {
  const loaded = loadBundle();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;

  const bundle = loadBundleFromString(loaded.raw);
  const arrivals = buildArrivalsChart(bundle);
  const receipts = buildReceiptsChart(bundle);
  const latestVisitor = arrivals.series.find((s) => s.basis === "visitor");
  const latestValue = latestVisitor
    ? [...latestVisitor.points].reverse().find((p) => p[1] !== null)?.[1]
    : undefined;

  // Ticket T6 headline framing (user-settled): the stagnation line + the
  // cumulative real gap headline; the regional gap is NEVER here — it lives
  // on /diagnosis/regional as supporting context. All figures from the bundle.
  const mb = bundle.fragments.missing_billions;
  const headline = mb
    ? buildDecomposition(mb)
    : undefined;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <h1>The Missing Billions</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        Malaysia&apos;s tourism recovery measures <strong>visitors, not value</strong>.
        Arrivals are back — but receipts per visitor are not. Both sides are shown
        from the same validated data bundle (bundle v{bundle.bundle_version}, schema {bundle.schema_version}).
      </p>
      {headline && (
        <p style={{ fontSize: "1.05rem", color: "#c8ccd4", borderLeft: "3px solid #e0564f", paddingLeft: "12px" }}>
          Six years, record arrivals — and each visitor worth exactly what a 2019
          visitor was worth in 2019 money. Cumulative real gap {headline.gapYears.from}–{headline.gapYears.to}:{" "}
          <strong>RM {(headline.cumulativeGapRmMillion / 1000).toLocaleString("en-MY", { maximumFractionDigits: 1 })} billion</strong>.
        </p>
      )}
      <p style={{ fontSize: 13 }}>
        <Link href="/diagnosis/decomposition" style={{ color: "#4f8cff" }}>
          The decomposition: volume vs value →
        </Link>{" "}
        <span style={{ color: "#9aa0a6" }}>the stagnation, in real terms (ticket T6)</span>
        <br />
        <Link href="/diagnosis/source-markets" style={{ color: "#4f8cff" }}>
          Source-market yield map →
        </Link>{" "}
        <span style={{ color: "#9aa0a6" }}>where the Volume Trap lives (ticket T6)</span>
        <br />
        <Link href="/diagnosis/regional" style={{ color: "#4f8cff" }}>
          Regional comparison →
        </Link>{" "}
        <span style={{ color: "#9aa0a6" }}>supporting context, with basis caveats (ticket T6)</span>
        <br />
        <Link href="/method" style={{ color: "#4f8cff" }}>
          Method &amp; sources →
        </Link>{" "}
        <span style={{ color: "#9aa0a6" }}>every number, linked to its official source (ticket T6)</span>
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 13 }}>
        2024 visitor arrivals: {typeof latestValue === "number" ? latestValue.toLocaleString("en-MY") : "n/a"} ·
        {" "}Bundle generated {bundle.generated_utc} · checksum verified at build time
      </p>
      <p style={{ fontSize: 13 }}>
        <a href="/simulator" style={{ color: "#4f8cff" }}>
          Try the market-mix simulator →
        </a>{" "}
        <span style={{ color: "#9aa0a6" }}>
          recompute the Missing Billions for any mix, live in your browser (ticket T7)
        </span>
      </p>
      <NationalChart spec={arrivals} />
      <NationalChart spec={receipts} />
    </main>
  );
}

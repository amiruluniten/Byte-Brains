/**
 * Simulator page (ticket T7) — static export, build-time bundle read, no
 * runtime data fetching. The mix arithmetic itself lives in
 * components/SimulatorPanel.tsx + lib/simulator.ts and runs in the browser.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BundleLoadError, loadBundleFromString } from "../../lib/bundle";
import SimulatorPanel, { type ReconciliationRef } from "../../components/SimulatorPanel";

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

export default function SimulatorPage() {
  const loaded = loadBundle();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;

  const bundle = loadBundleFromString(loaded.raw);
  const frag = bundle.simulator;
  if (!frag) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Market-mix simulator</h1>
        <p>
          The data bundle was built without simulator coefficients (no{" "}
          <code>simulator</code> fragment). Re-run the pipeline (ticket T7
          exporter) and rebuild.
        </p>
      </main>
    );
  }

  // The reconciliation reference comes from the same checksum-verified bundle
  // string (the Missing Billions headline row for the mix year).
  const raw = JSON.parse(loaded.raw) as {
    fragments: {
      missing_billions: {
        years: {
          year: number;
          gap_2019_prices_rm_million: number;
          actual_receipts_2019_prices_rm_million: number;
          counterfactual_receipts_2019_prices_rm_million: number;
        }[];
      };
    };
  };
  const mbRow = raw.fragments.missing_billions.years.find(
    (y) => y.year === frag.mix_year
  );
  if (!mbRow) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Market-mix simulator</h1>
        <p>
          The bundle has no {frag.mix_year} Missing Billions row to reconcile
          against; re-run the pipeline.
        </p>
      </main>
    );
  }
  const reconciliation: ReconciliationRef = {
    gap_2019_prices_rm_million: mbRow.gap_2019_prices_rm_million,
    actual_receipts_2019_prices_rm_million: mbRow.actual_receipts_2019_prices_rm_million,
    counterfactual_2019_prices_rm_million: mbRow.counterfactual_receipts_2019_prices_rm_million,
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <h1>Market-mix simulator</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        What if the same visitors arrived in a different{" "}
        <strong>market mix</strong>? Total receipts, yield per visitor and the
        Missing Billions gap recompute live — transparent arithmetic on the
        pipeline&apos;s exported per-market yields, never a black box.
      </p>
      <SimulatorPanel frag={frag} reconciliation={reconciliation} />
    </main>
  );
}

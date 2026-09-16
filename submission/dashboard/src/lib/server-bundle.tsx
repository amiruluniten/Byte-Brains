import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BundleLoadError,
  loadBundleFromString,
  type Bundle,
} from "./bundle";

/**
 * Build-time bundle loader shared by the diagnosis/method pages (ticket T6).
 * Same failure contract as the landing page: a missing or corrupt bundle
 * renders the error notice, never a blank page or made-up numbers.
 */
export type LoadedBundle =
  | { ok: true; raw: string; bundle: Bundle }
  | { ok: false; message: string };

export function loadBundleForPages(): LoadedBundle {
  const bundlePath = join(process.cwd(), "data", "bundle.json");
  try {
    const raw = readFileSync(bundlePath, "utf8");
    return { ok: true, raw, bundle: loadBundleFromString(raw) };
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

export function ErrorNotice({ message }: { message: string }) {
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

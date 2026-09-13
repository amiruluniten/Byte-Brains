import Link from "next/link";
import { buildMethodIndex } from "../../lib/diagnosis";
import { ErrorNotice, loadBundleForPages } from "../../lib/server-bundle";

export const metadata = { title: "Method & sources — The Missing Billions" };

/**
 * Method & sources: every fragment's derivation method, every number's
 * official source, and the exact bundle version (+ checksum) the dashboard
 * was built from. Static export; the links are the official publisher URLs
 * recorded in the bundle itself.
 */
export default function MethodPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;
  const bundle = loaded.bundle;
  const index = buildMethodIndex(bundle);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: "#4f8cff" }}>← The Missing Billions</Link>
      </p>
      <h1>Method &amp; sources</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        Every number on this dashboard is rendered from one validated data bundle.
        This page states each fragment&apos;s method and links every figure to its
        official source.
      </p>

      <div style={versionBox}>
        <strong>Data bundle v{index.bundleVersion}</strong> (schema {index.schemaVersion})
        <br />
        Generated {index.generatedUtc} · checksum <code style={{ wordBreak: "break-all" }}>{index.checksum}</code>
        <br />
        <span style={{ color: "#9aa0a6", fontSize: 13 }}>
          The checksum is verified at build time over the canonical JSON the pipeline
          emits; the report cites this exact version.
        </span>
      </div>

      {index.entries.map((e) => (
        <section key={e.fragment} style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: 4 }}>
            <code>{e.fragment}</code> <span style={{ color: "#9aa0a6", fontSize: 14 }}>(ticket {e.ticket})</span>
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{e.method}</p>
          <ul style={{ fontSize: 14, lineHeight: 1.7 }}>
            {e.sources.map((s, i) => (
              <li key={i}>
                {s.label}
                {s.url && (
                  <>
                    {" — "}
                    <a href={s.url} style={{ color: "#4f8cff" }}>{s.url}</a>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 13, color: "#9aa0a6" }}>
            Rendered on: {e.usedBy.map((u, i) => (
              <span key={u}>
                {i > 0 && ", "}
                <Link href={u} style={{ color: "#4f8cff" }}>{u}</Link>
              </span>
            ))}
          </p>
        </section>
      ))}

      <h2>Counting-basis discipline</h2>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Tourist-basis series (2015–2023) and visitor-basis series (2019–2024) are never
        merged: each series states its basis, window and source, and the series_id embeds
        the window. Regional comparisons carry their basis caveats (survey vs
        balance-of-payments vs administrative) on the page itself.
      </p>
    </main>
  );
}

const versionBox: React.CSSProperties = {
  background: "#1c1f27",
  border: "1px solid #3a3f4c",
  borderRadius: 8,
  padding: "12px 16px",
  fontSize: 14,
  marginBottom: "2rem",
  lineHeight: 1.6,
};

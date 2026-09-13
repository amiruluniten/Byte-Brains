import Link from "next/link";
import { buildRegionalComparison } from "../../../lib/diagnosis";
import { RegionalBarChart } from "../../../components/DiagnosisCharts";
import { ErrorNotice, loadBundleForPages } from "../../../lib/server-bundle";

export const metadata = { title: "Regional comparison — The Missing Billions" };

const fmt = (v: number) => v.toLocaleString("en-MY");

/**
 * Diagnosis 3: the regional receipts-per-visitor comparison (Thailand,
 * Indonesia vs Malaysia), from the bundle's regional_benchmark fragment.
 * FRAMING CONTRACT: supporting context for the Missing Billions — never the
 * headline. Basis caveats and the Vietnam exclusion are always shown.
 */
export default function RegionalPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;
  const bundle = loaded.bundle;

  const frag = bundle.fragments.regional_benchmark;
  if (!frag) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Regional comparison</h1>
        <p style={{ color: "#9aa0a6" }}>
          This bundle (v{bundle.bundle_version}) does not carry the
          regional_benchmark fragment, so the comparison cannot be drawn from
          the bundle alone. Nothing is shown rather than guessed.
        </p>
      </main>
    );
  }

  const comp = buildRegionalComparison(frag);
  const baseline = comp.rows.find((r) => r.isBaseline);
  const comparators = comp.rows.filter((r) => !r.isBaseline);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: "#4f8cff" }}>← The Missing Billions</Link>
        {" · "}
        <Link href="/diagnosis/source-markets" style={{ color: "#4f8cff" }}>← Source markets</Link>
      </p>
      <h1>Malaysia&apos;s yield gap is regional — and worse than its neighbours&apos;</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        This page is <strong>supporting context</strong> for the Missing Billions headline
        (RM10.2 billion real-terms gap, 2020–2024) — never a substitute for it.
        In {comp.anchorYear}, {comparators.map((r) => r.country).join(" and ")} each earned
        roughly {comparators.length ? `${Math.min(...comparators.filter((r) => r.multipleOfMalaysia !== null).map((r) => r.multipleOfMalaysia as number))}–${Math.max(...comparators.filter((r) => r.multipleOfMalaysia !== null).map((r) => r.multipleOfMalaysia as number))}` : "—"}×
        more per visitor than Malaysia, while Malaysia&apos;s own yield fell{" "}
        {baseline ? `${Math.abs(baseline.changePct)}%` : "—"} below its {comp.baselineYear} level.
      </p>

      <RegionalBarChart rows={comp.rows} anchorYear={comp.anchorYear} baselineYear={comp.baselineYear} />

      <h2>The numbers, with their basis</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Country</th>
            <th style={th}>Arrivals {comp.anchorYear}</th>
            <th style={th}>Receipts {comp.anchorYear} (USD bn)</th>
            <th style={th}>Yield {comp.anchorYear} (USD)</th>
            <th style={th}>Yield {comp.baselineYear} (WDI)</th>
            <th style={th}>vs own {comp.baselineYear}</th>
            <th style={th}>× Malaysia {comp.anchorYear}</th>
            <th style={th}>Receipts basis</th>
          </tr>
        </thead>
        <tbody>
          {comp.rows.map((r) => (
            <tr key={r.country} style={r.isBaseline ? { background: "#1a2030" } : undefined}>
              <td style={td}>{r.country}{r.isBaseline ? " (baseline)" : ""}</td>
              <td style={td}>{fmt(r.arrivals2024)}</td>
              <td style={td}>{r.usdBillion2024.toFixed(2)}</td>
              <td style={td}>${fmt(r.yield2024Usd)}</td>
              <td style={td}>${fmt(r.yield2019Usd)}</td>
              <td style={td}>{r.changePct > 0 ? "+" : ""}{r.changePct}%</td>
              <td style={td}>{r.multipleOfMalaysia === null ? "—" : `${r.multipleOfMalaysia.toFixed(1)}×`}</td>
              <td style={td}>{r.receiptsBasisLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul style={{ fontSize: 12, color: "#9aa0a6", lineHeight: 1.6 }}>
        {comp.rows.map((r) => (
          <li key={r.country}>
            <strong>{r.country}</strong>: {r.receiptsBasisNote} Sources:{" "}
            {r.sourceUrls.map((u, i) => (
              <span key={u}>
                {i > 0 && ", "}
                <a href={u} style={{ color: "#4f8cff" }}>{new URL(u).hostname}</a>
              </span>
            ))}
          </li>
        ))}
      </ul>

      <h2>Methodology caveats — read before comparing</h2>
      <ul style={{ lineHeight: 1.7, fontSize: 14 }}>
        {comp.caveats.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>Why a country is missing: {comp.excluded.map((e) => e.country).join(", ")}</h2>
      <ul style={{ lineHeight: 1.7, fontSize: 14 }}>
        {comp.excluded.map((e) => (
          <li key={e.country}>
            <strong>{e.country}</strong> — {e.reason}
          </li>
        ))}
      </ul>

      <p style={{ color: "#9aa0a6", fontSize: 13 }}>
        Researched and documented in <code>{comp.researchDoc}</code>; encoded in the bundle as
        the additive <code>regional_benchmark</code> fragment (bundle v{bundle.bundle_version},
        schema {bundle.schema_version}).
      </p>
    </main>
  );
}

const tableStyle: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 14 };
const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "2px solid #3a3f4c",
  padding: "8px 12px",
  fontSize: 13,
  color: "#9aa0a6",
};
const td: React.CSSProperties = { borderBottom: "1px solid #2a2e38", padding: "8px 12px", textAlign: "left" };

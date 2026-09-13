import Link from "next/link";
import { buildDecomposition } from "../../../lib/diagnosis";
import { LineChart } from "../../../components/DiagnosisCharts";
import { ErrorNotice, loadBundleForPages } from "../../../lib/server-bundle";

export const metadata = { title: "Extensive vs intensive — The Missing Billions" };

const fmtRm = (v: number) =>
  v.toLocaleString("en-MY", { maximumFractionDigits: 0 });

/**
 * Diagnosis 1: the extensive-vs-intensive decomposition. Volume growth vs
 * value growth, every trace labelled with its basis, the real-vs-nominal
 * distinction explicit, and the Volume Trap as the mechanism.
 */
export default function DecompositionPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;
  const bundle = loaded.bundle;

  const frag = bundle.fragments.missing_billions;
  if (!frag) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Extensive vs intensive</h1>
        <p style={{ color: "#9aa0a6" }}>
          This bundle (v{bundle.bundle_version}) does not carry the
          missing_billions fragment, so the decomposition cannot be computed
          from the bundle alone. Nothing is shown rather than guessed.
        </p>
      </main>
    );
  }

  const spec = buildDecomposition(frag);
  const gapB = (spec.cumulativeGapRmMillion / 1000).toLocaleString("en-MY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const drift = spec.stagnation.latestPerVisitorRealRm - spec.stagnation.anchorPerVisitorRealRm;
  const vt = frag.volume_trap;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: "#4f8cff" }}>← The Missing Billions</Link>
        {" · "}
        <Link href="/diagnosis/source-markets" style={{ color: "#4f8cff" }}>Source markets →</Link>
      </p>
      <h1>Growth in visitors, not in value per visitor</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        Six years, record arrivals — and by 2024 each visitor was worth exactly
        what a 2019 visitor was worth in 2019 money
        (RM {fmtRm(spec.stagnation.latestPerVisitorRealRm)} vs RM {fmtRm(spec.stagnation.anchorPerVisitorRealRm)}
        , {drift >= 0 ? "+" : ""}RM {fmtRm(drift)} after inflation).
        Cumulative real gap 2020–2024: <strong>RM {gapB} billion</strong> — the Missing Billions.
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 13 }}>
        The mechanism is the Volume Trap: arrival-count KPIs reward low-yield
        same-day traffic, so policy optimises for heads instead of value.
      </p>

      <h2>Volume vs value, indexed to {spec.anchorYear} = 100</h2>
      <LineChart
        title="Extensive vs intensive recovery"
        subtitle="Visitor arrivals (volume) against receipts in nominal and real 2019 terms (value), and the 2019-yield counterfactual. Bases are labelled below."
        traces={spec.indexed}
        yLabel="Index (2019 = 100)"
      />
      <ul style={{ fontSize: 12, color: "#9aa0a6", lineHeight: 1.6 }}>
        {spec.basisNotes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <h2>Real vs nominal: why the headline is real-terms only</h2>
      <LineChart
        title="Per-visitor receipts, nominal vs real 2019 RM"
        subtitle={`Nominal ringgit rose; deflated to ${spec.anchorYear} prices, each visitor was worth the same in ${spec.stagnation.latestYear} as in ${spec.anchorYear}. The nominal view flatters the recovery.`}
        traces={spec.perVisitor}
        yLabel="RM per visitor"
        height={380}
      />

      <h2>The Volume Trap, in the data</h2>
      <table style={tableStyle}>
        <tbody>
          <tr>
            <td style={td}>Same-day visitor (excursionist) share of arrivals, {frag.anchor_year}</td>
            <td style={td}>{vt.excursionist_share_2019_pct}%</td>
          </tr>
          <tr>
            <td style={td}>Same-day visitor share, 2024</td>
            <td style={td}>{vt.excursionist_share_2024_pct}% (+{vt.excursionist_share_change_pp} pp)</td>
          </tr>
          <tr>
            <td style={td}>Arrivals by land mode, 2024</td>
            <td style={td}>{vt.land_mode_share_2024_pct}%</td>
          </tr>
        </tbody>
      </table>
      <p style={{ color: "#9aa0a6", fontSize: 13 }}>
        Land-mode share source: {vt.land_mode_share_source}. Same-day and land traffic
        concentrates in the low-yield markets the map page names Volume Traps.
      </p>
    </main>
  );
}

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: 14,
};
const td: React.CSSProperties = {
  borderBottom: "1px solid #2a2e38",
  padding: "8px 12px",
  textAlign: "left",
};

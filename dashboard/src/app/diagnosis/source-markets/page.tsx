import Link from "next/link";
import { buildMarketMapData } from "../../../lib/diagnosis";
import { buildPrescriptions, PRESCRIPTION_LABELS } from "../../../lib/prescriptions";
import { YieldMap } from "../../../components/DiagnosisCharts";
import { ErrorNotice, loadBundleForPages } from "../../../lib/server-bundle";

export const metadata = { title: "Source markets — yield map & segments" };

const fmt = (v: number) => v.toLocaleString("en-MY");

/**
 * Diagnosis 2: the source-market yield map with the named-segment overlay.
 * Everything renders from the bundle's source_market + source_segmentation
 * fragments; when segmentation is missing from the bundle, the map still
 * shades by yield and the page says so.
 */
export default function SourceMarketsPage() {
  const loaded = loadBundleForPages();
  if (!loaded.ok) return <ErrorNotice message={loaded.message} />;
  const bundle = loaded.bundle;

  const sourceMarket = bundle.fragments.source_market;
  if (!sourceMarket) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Source markets</h1>
        <p style={{ color: "#9aa0a6" }}>
          This bundle (v{bundle.bundle_version}) does not carry the source_market
          fragment, so the yield map cannot be drawn from the bundle alone.
        </p>
      </main>
    );
  }

  const segmentation = bundle.fragments.source_segmentation;
  const mapData = buildMarketMapData(sourceMarket, segmentation);
  const prescriptions = buildPrescriptions(segmentation);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <p style={{ fontSize: 13 }}>
        <Link href="/" style={{ color: "#4f8cff" }}>← The Missing Billions</Link>
        {" · "}
        <Link href="/diagnosis/decomposition" style={{ color: "#4f8cff" }}>← Decomposition</Link>
        {" · "}
        <Link href="/diagnosis/regional" style={{ color: "#4f8cff" }}>Regional comparison →</Link>
      </p>
      <h1>Which markets carry the economy — and which trap it</h1>
      <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
        Receipts per visitor (RM) by source market, 2024. Toggle the overlay to
        shade by named segment instead. The low-yield, high-volume segment —{" "}
        <strong>Volume Traps</strong> — is the mechanism behind the Missing Billions.
      </p>
      <p style={{ color: "#9aa0a6", fontSize: 13 }}>
        Source: {sourceMarket.source_receipts.file} ({sourceMarket.source_receipts.table}) paired with{" "}
        {sourceMarket.source_arrivals.table}; per-market receipts and arrivals share the
        same counting basis. Bundle v{bundle.bundle_version}.
      </p>

      <YieldMap mapData={mapData} />

      {!mapData.segmentationAvailable && (
        <p style={{ color: "#9aa0a6" }}>
          The source_segmentation fragment is not in this bundle (the WEF TTDI input was
          unavailable at build time), so the named-segment overlay is hidden — never guessed.
        </p>
      )}

      <h2>Markets, segments and tiers</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Market</th>
            <th style={th}>Yield 2024 (RM/visitor)</th>
            <th style={th}>Arrivals 2024</th>
            <th style={th}>Segment</th>
            <th style={th}>Yield tier</th>
          </tr>
        </thead>
        <tbody>
          {mapData.markets
            .slice()
            .sort((a, b) => (b.yieldRmPerVisitor ?? -1) - (a.yieldRmPerVisitor ?? -1))
            .map((m) => (
              <tr key={m.market}>
                <td style={td}>{m.market}</td>
                <td style={td}>{m.yieldRmPerVisitor === null ? "n/a (partial coverage)" : fmt(m.yieldRmPerVisitor)}</td>
                <td style={td}>{m.arrivals2024 === null ? "n/a" : fmt(m.arrivals2024)}</td>
                <td style={td}>{m.segmentName ?? <span style={{ color: "#9aa0a6" }}>not clustered{m.excludedReason ? ` — ${m.excludedReason}` : ""}</span>}</td>
                <td style={td}>{m.tierLabel ?? "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {prescriptions.available && (
        <>
          <h2>What to do with each market — per-market prescriptions</h2>
          <p style={{ fontSize: "1.05rem", color: "#c8ccd4" }}>
            One verdict per market, derived from its segment (the rule is on the{" "}
            <Link href="/method" style={{ color: "#4f8cff" }}>method page</Link>) — with the
            numbers behind it, so every recommendation is traceable to the bundle.
          </p>
          {prescriptions.unrulySegments.length > 0 && (
            <p style={{ color: "#9aa0a6", fontSize: 13 }}>
              No prescription rule covers the segment(s) {prescriptions.unrulySegments.join(", ")} —
              those markets are held out rather than guessed.
            </p>
          )}
          <div style={{ display: "grid", gap: "1rem" }}>
            {prescriptions.rows.map((p) => (
              <div key={p.market} style={rxCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15 }}>{p.market}</strong>
                  <span style={rxBadge(p.prescription)}>{PRESCRIPTION_LABELS[p.prescription]}</span>
                </div>
                <p style={{ margin: "0.4rem 0", fontSize: 13, lineHeight: 1.6, color: "#c8ccd4" }}>
                  {p.rationale}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "#9aa0a6" }}>
                  Segment: {p.segmentName} · yield tier: {p.tierLabel ?? "—"}
                </p>
                <table style={{ ...tableStyle, marginTop: "0.5rem" }}>
                  <thead>
                    <tr>
                      <th style={th}>Yield 2024 (RM/visitor)</th>
                      <th style={th}>Arrivals 2024</th>
                      <th style={th}>Arrivals growth (vs 2023)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={td}>{p.yieldRmPerVisitor === null ? "n/a" : `RM ${fmt(p.yieldRmPerVisitor)}`}</td>
                      <td style={td}>{p.arrivals2024 === null ? "n/a" : fmt(p.arrivals2024)}</td>
                      <td style={td}>
                        {p.arrivalsGrowthPct === null ? "n/a" : `${p.arrivalsGrowthPct >= 0 ? "+" : ""}${p.arrivalsGrowthPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          {prescriptions.unclustered.length > 0 && (
            <p style={{ color: "#9aa0a6", fontSize: 13 }}>
              No prescription for markets left out of the clustering
              ({prescriptions.unclustered.map((u) => `${u.market}${u.excludedReason ? ` — ${u.excludedReason}` : ""}`).join("; ")}):
              a verdict without cluster evidence would be a guess.
            </p>
          )}
        </>
      )}

      {segmentation && (
        <>
          <h2>Why each segment is named that</h2>
          <p style={{ color: "#9aa0a6", fontSize: 14 }}>{segmentation.naming_rationale}</p>
          <ul style={{ lineHeight: 1.7, fontSize: 14 }}>
            {segmentation.clusters.map((c) => (
              <li key={c.cluster_id}>
                <strong>{c.segment_name}</strong> — mean yield RM {fmt(c.mean_yield_rm_per_visitor)}:{" "}
                {c.naming_rationale} <span style={{ color: "#9aa0a6" }}>({c.members.join(", ")})</span>
              </li>
            ))}
          </ul>
          <p style={{ color: "#9aa0a6", fontSize: 13 }}>
            Method: {segmentation.method}, seed {segmentation.seed}. Tiers are quartiles of the
            same 2024 yields ({Object.entries(segmentation.yield_quartile_boundaries)
              .map(([k, v]) => `${k}: RM ${fmt(v)}`)
              .join(", ")}).
          </p>
        </>
      )}
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
const rxCard: React.CSSProperties = {
  background: "#1c1f27",
  border: "1px solid #3a3f4c",
  borderRadius: 8,
  padding: "12px 16px",
};
const RX_COLORS: Record<string, string> = {
  grow: "#4ade80",
  coast: "#9aa0a6",
  reduce_reliance: "#fbbf24",
};
function rxBadge(p: string): React.CSSProperties {
  return {
    color: RX_COLORS[p] ?? "#9aa0a6",
    border: `1px solid ${RX_COLORS[p] ?? "#9aa0a6"}`,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 13,
    whiteSpace: "nowrap",
  };
}

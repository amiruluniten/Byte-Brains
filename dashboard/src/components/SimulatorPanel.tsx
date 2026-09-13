"use client";

/**
 * The live market-mix simulator (ticket T7) — the demo moment.
 *
 * Sliders hold RAW WEIGHTS (percent points); effective shares are the
 * normalised weights, so any slider move re-normalises the mix instantly.
 * Every output below is CONSTANT-2019-PRICES arithmetic on the pipeline's
 * exported coefficients (`simulateMix`), recomputed in the browser with no
 * network call — see ADR-0002.
 */
import { useMemo, useState } from "react";
import {
  normalizeShares,
  policySingaporeShift,
  shares2023,
  shares2024,
  simulateFragmentMix,
  type SimulatorFragment,
} from "../lib/simulator";

export interface ReconciliationRef {
  /** The headline calculator's 2024 real gap, RM million (missing_billions fragment). */
  gap_2019_prices_rm_million: number;
  actual_receipts_2019_prices_rm_million: number;
  counterfactual_2019_prices_rm_million: number;
}

interface Props {
  frag: SimulatorFragment;
  reconciliation: ReconciliationRef;
}

type Preset = "actual2024" | "earliest2023" | "policy" | "custom";

function fmtBn(rmMillion: number): string {
  return (rmMillion / 1000).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(share: number): string {
  return (share * 100).toLocaleString("en-MY", { maximumFractionDigits: 2 });
}

export default function SimulatorPanel({ frag, reconciliation }: Props) {
  const [weights, setWeights] = useState<number[]>(() =>
    shares2024(frag).map((s) => s * 100)
  );
  const [activePreset, setActivePreset] = useState<Preset>("actual2024");

  const shares = useMemo(() => normalizeShares(weights), [weights]);
  const result = useMemo(
    () =>
      simulateFragmentMix(frag, shares),
    [frag, shares]
  );

  function applyPreset(p: Preset) {
    setActivePreset(p);
    const target =
      p === "actual2024"
        ? shares2024(frag)
        : p === "earliest2023"
          ? shares2023(frag)
          : policySingaporeShift(frag);
    setWeights(target.map((s) => s * 100));
  }

  function setWeight(i: number, value: number) {
    setActivePreset("custom");
    setWeights((prev) => prev.map((w, j) => (j === i ? value : w)));
  }

  const missing = result.gap_2019_prices_rm_million > 0;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <p
        style={{
          margin: 0,
          padding: "0.6rem 0.9rem",
          border: "1px solid #3a3f4d",
          borderRadius: 8,
          background: "#161a23",
          fontSize: 13,
          color: "#c8ccd4",
        }}
      >
        <strong>All figures are CONSTANT 2019 PRICES</strong> — every yield is
        deflated by the DOSM national CPI ({frag.cpi_series_id}, 2019 →{" "}
        {frag.mix_year} ratio {frag.cpi_ratio_to_anchor_mix_year.toFixed(4)}).
        This isolates value per visitor from inflation, exactly like the
        Missing Billions headline. No network calls: the arithmetic runs in
        your browser on coefficients exported from the pipeline.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(
          [
              ["actual2024", `${frag.mix_year} actual mix`],
              ["earliest2023", `${frag.comparison_year} mix (earliest observed)`],
              ["policy", `Policy: shift ${"Singapore"} to top-yield markets`],
          ] as [Preset, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            style={{
              cursor: "pointer",
              borderRadius: 999,
              padding: "0.4rem 0.9rem",
              fontSize: 13,
              border: "1px solid " + (activePreset === key ? "#4f8cff" : "#3a3f4d"),
              background: activePreset === key ? "#1d2b4a" : "#161a23",
              color: "#e6e6e6",
            }}
          >
            {label}
          </button>
        ))}
        {activePreset === "policy" && (
          <span style={{ alignSelf: "center", fontSize: 12, color: "#9aa0a6" }}>
            moves half of Singapore&apos;s share to the three highest-yield
            markets (pro-rata), {frag.mix_year} volumes held constant
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Output
          label="Total receipts (2019 prices)"
          value={`RM ${fmtBn(result.receipts_2019_prices_rm_million)} bn`}
          hint={`${frag.visitor_arrivals_2024.toLocaleString("en-MY")} visitors × mix yield`}
        />
        <Output
          label="Yield per visitor (2019 RM)"
          value={`RM ${result.yield_per_visitor_real_rm.toLocaleString("en-MY", {
            maximumFractionDigits: 2,
          })}`}
          hint={`mix-weighted across ${frag.markets.length} market buckets`}
        />
        <Output
          label="2019-yield counterfactual"
          value={`RM ${fmtBn(result.counterfactual_2019_prices_rm_million)} bn`}
          hint={`same visitors at the ${frag.anchor_year} real yield (RM ${frag.anchor_per_visitor_real_2019_rm.toFixed(
            2
          )})`}
        />
        <div
          style={{
            border: "1px solid",
            borderRadius: 8,
            padding: "0.75rem 0.9rem",
            borderColor: missing ? "#ff6b6b" : "#39b46e",
            background: missing ? "#2a161a" : "#14231b",
          }}
        >
          <div style={{ fontSize: 12, color: "#9aa0a6" }}>
            Missing Billions gap (2019 prices)
          </div>
          <div
            style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 4 }}
          >
            {missing ? "+" : "−"}RM {fmtBn(Math.abs(result.gap_2019_prices_rm_million))} bn
          </div>
          <div style={{ fontSize: 12, color: "#9aa0a6", marginTop: 4 }}>
            {missing
              ? "below the 2019-yield counterfactual — missing billions"
              : "above the 2019-yield counterfactual (yield per visitor beat 2019)"}
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
          Market mix sliders
        </h2>
        <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#9aa0a6" }}>
          Sliders hold raw weights; the mix is always re-normalised to 100% of{" "}
          {frag.visitor_arrivals_2024.toLocaleString("en-MY")} visitors. Yields
          are the pipeline&apos;s {frag.mix_year} coefficients in constant {frag.anchor_year} prices.
        </p>
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {frag.markets.map((m, i) => (
            <label
              key={m.market}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(140px, 220px) 1fr 70px 90px",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: 13,
              }}
            >
              <span>
                {m.market}
                {m.coverage === "residual" && (
                  <span style={{ color: "#9aa0a6" }}> · residual bucket</span>
                )}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={weights[i]}
                onChange={(e) => setWeight(i, Number(e.target.value))}
                aria-label={`${m.market} share weight`}
              />
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {fmtPct(shares[i])}%
              </span>
              <span
                style={{
                  textAlign: "right",
                  color: "#9aa0a6",
                  fontVariantNumeric: "tabular-nums",
                }}
                title="Real yield per visitor, 2019 RM (the residual bucket has no observable nominal yield)"
              >
                RM {m.yield_2024_real_2019_rm_per_visitor.toLocaleString("en-MY", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>
          Where the receipts come from (2019 prices)
        </h2>
        <div style={{ display: "grid", gap: "0.3rem" }}>
          {frag.markets.map((m, i) => {
            const contribution = result.contributions_2019_prices_rm_million[i];
            const max = Math.max(
              ...result.contributions_2019_prices_rm_million,
              1e-9
            );
            return (
              <div
                key={m.market}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(140px, 220px) 1fr 110px",
                  gap: "0.6rem",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span>{m.market}</span>
                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    background: "#1c1f27",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(contribution / max) * 100}%`,
                      height: "100%",
                      background: "#4f8cff",
                    }}
                  />
                </div>
                <span
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    color: "#9aa0a6",
                  }}
                >
                  RM {fmtBn(contribution)} bn
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, color: "#9aa0a6" }}>
        Reconciliation: at the {frag.mix_year} actual mix this panel reproduces
        the pipeline&apos;s Missing Billions arithmetic exactly — actual
        receipts RM {fmtBn(reconciliation.actual_receipts_2019_prices_rm_million)}{" "}
        bn, counterfactual RM{" "}
        {fmtBn(reconciliation.counterfactual_2019_prices_rm_million)} bn, gap{" "}
        {reconciliation.gap_2019_prices_rm_million >= 0 ? "+" : "−"}RM{" "}
        {fmtBn(Math.abs(reconciliation.gap_2019_prices_rm_million))} bn (2019
        prices); proven by round-trip tests. Coefficients: Tourism Malaysia In
        Brief 2024 top-20 yields (visitor basis) deflated by the DOSM national
        CPI; the residual bucket folds in non-top-20 visitors, the four
        partial-coverage top-20 markets, and the In Brief vs TSA receipts basis
        difference.
      </p>
    </div>
  );
}

function Output({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        border: "1px solid #3a3f4d",
        borderRadius: 8,
        padding: "0.75rem 0.9rem",
        background: "#161a23",
      }}
    >
      <div style={{ fontSize: 12, color: "#9aa0a6" }}>{label}</div>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#9aa0a6", marginTop: 4 }}>{hint}</div>
    </div>
  );
}
